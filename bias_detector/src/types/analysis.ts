export interface EvidenceItem {
  quote: string;
  section: string;
}

export interface JustificationSection {
  summary: string;
  evidence: EvidenceItem[];
}

export interface BiasAnalysis {
  biasScore: number; // 1-5
  biasMeaning: string;
  justification: {
    sampleRepresentation: JustificationSection;
    inclusionInAnalysis: JustificationSection;
    studyOutcomes: JustificationSection;
    methodologicalFairness: JustificationSection;
  };
}
