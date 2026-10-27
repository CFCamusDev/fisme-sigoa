import crypto from 'node:crypto';

export type ReferenceItemStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface ReferenceItemProps {
  id: string;
  code: string;
  title: string;
  status: ReferenceItemStatus;
  createdAt: Date;
}

export class ReferenceItem {
  private constructor(private readonly props: ReferenceItemProps) {}

  public static create(params: { code: string; title: string }): ReferenceItem {
    const trimmedCode = params.code?.trim();
    const trimmedTitle = params.title?.trim();

    if (!trimmedCode) {
      throw new Error('Reference item code cannot be empty');
    }
    if (!trimmedTitle) {
      throw new Error('Reference item title cannot be empty');
    }

    return new ReferenceItem({
      id: crypto.randomUUID(),
      code: trimmedCode,
      title: trimmedTitle,
      status: 'DRAFT',
      createdAt: new Date(),
    });
  }

  public static fromPersistence(props: ReferenceItemProps): ReferenceItem {
    return new ReferenceItem(props);
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get title(): string {
    return this.props.title;
  }

  get status(): ReferenceItemStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toDto(): {
    id: string;
    code: string;
    title: string;
    status: ReferenceItemStatus;
    createdAt: string;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      title: this.props.title,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}
