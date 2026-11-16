import type { Stakeholder } from './stakeholder.js';
import type { StakeholderList } from './stakeholder-list.js';
import { IneligibleListMemberError } from '../errors/ineligible-list-member-error.js';
import {
  buildStakeholderListMemberSnapshot,
  type StakeholderListMemberDetails,
} from '../policies/stakeholder-list-type-fields.js';

export interface StakeholderListMemberProperties {
  readonly id: string;
  readonly listId: string;
  readonly stakeholderId: string;
  readonly fullName: string;
  readonly institution: string | null;
  readonly ruc: string | null;
  readonly sector: string | null;
  readonly representative: string | null;
  readonly activity: string | null;
  readonly email: string | null;
  readonly mobile: string | null;
  readonly position: string | null;
  readonly graduationYear: number | null;
  readonly cycle: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface CreateStakeholderListMemberInput {
  readonly id: string;
  readonly list: StakeholderList;
  readonly stakeholder: Stakeholder;
  readonly details?: StakeholderListMemberDetails;
  readonly actorId: string;
  readonly now?: Date;
}

/** Instantánea de auditoría sin exponer correo ni celular (D7, RNF-012). */
export interface StakeholderListMemberAuditSnapshot {
  readonly listId: string;
  readonly stakeholderId: string;
  readonly fullName: string;
  readonly institution: string | null;
  readonly ruc: string | null;
  readonly sector: string | null;
  readonly representative: string | null;
  readonly activity: string | null;
  readonly hasEmail: boolean;
  readonly hasMobile: boolean;
  readonly position: string | null;
  readonly graduationYear: number | null;
  readonly cycle: string | null;
}

export class StakeholderListMember {
  private constructor(private readonly props: StakeholderListMemberProperties) {}

  /** Reconstruye un miembro ya persistido sin revalidar la instantánea histórica. */
  public static reconstitute(props: StakeholderListMemberProperties): StakeholderListMember {
    return new StakeholderListMember(props);
  }

  public static create(input: CreateStakeholderListMemberInput): StakeholderListMember {
    if (input.stakeholder.status === 'VOIDED') {
      throw new IneligibleListMemberError();
    }

    const snapshotFields = buildStakeholderListMemberSnapshot(
      input.list.type,
      input.stakeholder,
      input.details,
    );

    return new StakeholderListMember({
      id: input.id,
      listId: input.list.id,
      stakeholderId: input.stakeholder.id,
      ...snapshotFields,
      createdBy: input.actorId,
      createdAt: input.now ?? new Date(),
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get listId(): string {
    return this.props.listId;
  }

  public get stakeholderId(): string {
    return this.props.stakeholderId;
  }

  public get fullName(): string {
    return this.props.fullName;
  }

  public get institution(): string | null {
    return this.props.institution;
  }

  public get ruc(): string | null {
    return this.props.ruc;
  }

  public get sector(): string | null {
    return this.props.sector;
  }

  public get representative(): string | null {
    return this.props.representative;
  }

  public get activity(): string | null {
    return this.props.activity;
  }

  public get email(): string | null {
    return this.props.email;
  }

  public get mobile(): string | null {
    return this.props.mobile;
  }

  public get position(): string | null {
    return this.props.position;
  }

  public get graduationYear(): number | null {
    return this.props.graduationYear;
  }

  public get cycle(): string | null {
    return this.props.cycle;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public snapshot(): StakeholderListMemberAuditSnapshot {
    return {
      listId: this.props.listId,
      stakeholderId: this.props.stakeholderId,
      fullName: this.props.fullName,
      institution: this.props.institution,
      ruc: this.props.ruc,
      sector: this.props.sector,
      representative: this.props.representative,
      activity: this.props.activity,
      hasEmail: this.props.email !== null,
      hasMobile: this.props.mobile !== null,
      position: this.props.position,
      graduationYear: this.props.graduationYear,
      cycle: this.props.cycle,
    };
  }
}
