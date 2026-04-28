import mongoose, { Schema, Document } from 'mongoose';

export type LeadStatus = 'New' | 'Contacted' | 'In Progress' | 'Negotiation' | 'Closed' | 'Lost';
export type LeadPriority = 'High' | 'Medium' | 'Low';
export type PropertyInterest = 'Residential' | 'Commercial' | 'Plot' | 'Apartment' | 'Villa' | 'Office';
export type LeadSource = 'Facebook Ads' | 'Walk-in' | 'Website' | 'Referral' | 'Other';

export interface ILead extends Document {
  name: string;
  email: string;
  phone: string;
  propertyInterest: PropertyInterest;
  location: string;
  budget: number;
  status: LeadStatus;
  priority: LeadPriority;
  score: number;
  notes: string;
  source: LeadSource;
  assignedTo?: mongoose.Types.ObjectId;
  followUpDate?: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    propertyInterest: {
      type: String,
      enum: ['Residential', 'Commercial', 'Plot', 'Apartment', 'Villa', 'Office'],
      required: true,
    },
    location: { type: String, required: true, trim: true },
    budget: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'In Progress', 'Negotiation', 'Closed', 'Lost'],
      default: 'New',
    },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Low',
    },
    score: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    source: {
      type: String,
      enum: ['Facebook Ads', 'Walk-in', 'Website', 'Referral', 'Other'],
      default: 'Other',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    followUpDate: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Auto-scoring middleware
LeadSchema.pre('save', function (next) {
  if (this.isModified('budget') || this.isNew) {
    const budgetInMillions = this.budget / 1_000_000;
    if (budgetInMillions > 20) {
      this.priority = 'High';
      this.score = 100;
    } else if (budgetInMillions >= 10) {
      this.priority = 'Medium';
      this.score = 60;
    } else {
      this.priority = 'Low';
      this.score = 20;
    }
  }
  next();
});

LeadSchema.index({ status: 1, priority: 1, assignedTo: 1 });

export default mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
