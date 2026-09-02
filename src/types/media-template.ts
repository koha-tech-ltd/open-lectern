export type MediaTemplateMedium = 'schematic' | 'animated' | 'diagram' | 'card';

export type MediaTemplateParamType = 'string' | 'string[]' | 'number' | 'number[]' | 'boolean';

export interface MediaTemplateParamSpec {
  key: string;
  type: MediaTemplateParamType;
  required?: boolean;
  description: string;
  example?: string | number | boolean | string[];
}

export interface MediaTemplateDefinition {
  id: string;
  title: string;
  description: string;
  medium: MediaTemplateMedium;
  tags: string[];
  /** Short agent-facing recipe for when to pick this template */
  whenToUse: string;
  params: MediaTemplateParamSpec[];
  animated: boolean;
}

export type MediaTemplateParams = Record<string, unknown>;

export interface RenderedMediaTemplate {
  svg: string;
  width: number;
  height: number;
  dataUrl: string;
  templateId: string;
  animated: boolean;
}
