import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant extends Document {
  id: string;
  name: string;
  email: string;
  phone?: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  category: { type: String, default: 'General' },
}, {
  timestamps: true
});

export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);
export type Participant = IParticipant;
export type NewParticipant = Omit<IParticipant, '_id' | 'createdAt' | 'updatedAt'>;