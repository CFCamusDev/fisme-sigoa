import { randomUUID } from 'node:crypto';
import type { UserDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { User } from '../domain/entities/user.js';
import { assertUserIdentityAvailable } from '../domain/policies/user-uniqueness.js';
import type {
  ActivationEmailSender,
  ActivationTokenIssuer,
  PermissionChecker,
  UserRepository,
  UserRoleGateway,
} from '../domain/ports/index.js';
import type { CreateUserCommand } from './create-user.types.js';
import { toUserDto } from './user-dto.js';

export interface CreateUserDependencies {
  userRepository: UserRepository;
  permissionChecker: PermissionChecker;
  userRoleGateway: UserRoleGateway;
  activationTokenIssuer: ActivationTokenIssuer;
  activationEmailSender: ActivationEmailSender;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  idGenerator?: () => string;
  clock?: () => Date;
  logger?: { error: (message: string, error?: unknown) => void };
}

export class CreateUserUseCase {
  private readonly userRepository: UserRepository;
  private readonly permissionChecker: PermissionChecker;
  private readonly userRoleGateway: UserRoleGateway;
  private readonly activationTokenIssuer: ActivationTokenIssuer;
  private readonly activationEmailSender: ActivationEmailSender;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;
  private readonly logger?: { error: (message: string, error?: unknown) => void };

  constructor(deps: CreateUserDependencies) {
    this.userRepository = deps.userRepository;
    this.permissionChecker = deps.permissionChecker;
    this.userRoleGateway = deps.userRoleGateway;
    this.activationTokenIssuer = deps.activationTokenIssuer;
    this.activationEmailSender = deps.activationEmailSender;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
    this.logger = deps.logger;
  }

  async execute(command: CreateUserCommand): Promise<UserDto> {
    // 1. Verificar permiso y alcance antes de leer cualquier entidad (RS-002, AGENTS §4.2)
    await this.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.crear',
      scope: 'GLOBAL',
    });

    const now = this.clock();

    // 2. Persistir, asignar roles, emitir token y auditar dentro de la misma transacción (RNF-022, RS-020)
    const { user, tokenResult } = await this.unitOfWork.run(async () => {
      const existingByEmail = await this.userRepository.findByEmail(command.input.email);
      const existingByDni = await this.userRepository.findByDni(command.input.dni);

      assertUserIdentityAvailable({
        email: command.input.email,
        dni: command.input.dni,
        byEmail: existingByEmail,
        byDni: existingByDni,
      });

      const id = this.idGenerator();
      const newUser = User.create({
        id,
        names: command.input.names,
        firstSurname: command.input.firstSurname,
        secondSurname: command.input.secondSurname,
        email: command.input.email,
        dni: command.input.dni,
        createdBy: command.actorId,
      });

      await this.userRepository.add(newUser);
      await this.userRoleGateway.replaceRoles(newUser.id, command.input.roleIds);

      const issuedToken = await this.activationTokenIssuer.issue(newUser.id, now);

      await this.auditLogger.log({
        action: 'CREATE',
        entity: 'User',
        entityId: newUser.id,
        actorId: command.actorId,
        ipAddress: command.ip,
        after: {
          ...newUser.toAuditSnapshot(),
          roleIds: command.input.roleIds,
        },
      });

      return { user: newUser, tokenResult: issuedToken };
    });

    // 3. Envío de correo posterior al commit exitoso de la transacción (D4)
    try {
      await this.activationEmailSender.send({
        to: user.email,
        names: user.names,
        activationToken: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    } catch (error) {
      // Un fallo del correo no revierte el alta ni expone datos sensibles o tokens en logs
      this.logger?.error('Error al enviar el correo de activación tras crear usuario', error);
    }

    return toUserDto(user, command.input.roleIds);
  }
}
