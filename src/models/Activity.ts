import mongoose, { Schema, Document } from 'mongoose';

export type ActivityType =
  | 'created'
  | 'status_updated'
  | 'assigned'
  | 'reassigned'
  | 'notes_updated'
  | 'follow_up_set'
  | 'priority_changed'
  | 'contacted';

export interface IActivity extends Document {
  lead: mongoose.Types.ObjectId;
  performedBy: mongoose.Types.ObjectId;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'created',
        'status_updated',
        'assigned',
        'reassigned',
        'notes_updated',
        'follow_up_set',
        'priority_changed',
        'contacted',
      ],
      required: true,
    },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivitySchema.index({ lead: 1, createdAt: -1 });

export default mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);
