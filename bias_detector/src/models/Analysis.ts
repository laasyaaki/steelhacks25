import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalysis extends Document {
  url: string;
  biasScore: number;
  createdAt: Date;
}

const AnalysisSchema: Schema = new Schema({
  url: { type: String, required: true },
  biasScore: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Analysis || mongoose.model<IAnalysis>('Analysis', AnalysisSchema);
