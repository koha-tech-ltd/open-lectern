import { useMemo, useState } from 'react';
import { listMediaTemplateSummaries, renderMediaTemplate } from '@/lib/media-templates';
import { createId } from '@/lib/lesson';
import type { MediaTemplateDefinition, MediaTemplateParamSpec } from '@/types/media-template';
import type { SectionMedia } from '@/types/lesson';
import { useI18n } from '@/i18n/I18nProvider';

export function SectionMediaTemplates({
  onAdd,
  onClose,
}: {
  onAdd: (media: SectionMedia) => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const templates = useMemo(() => listMediaTemplateSummaries(), []);
  const [selectedId, setSelectedId] = useState('title-card');
  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const [params, setParams] = useState<Record<string, unknown>>(() => defaultParams(templates[0]));
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    setSelectedId(templateId);
    setParams(defaultParams(template));
    setPreview(null);
    setError(null);
  };

  const renderPreview = () => {
    if (!selected) return;
    try {
      const rendered = renderMediaTemplate(selected.id, params);
      setPreview(rendered.dataUrl);
      setError(null);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : t('templates.renderFail'));
    }
  };

  const attachPreview = () => {
    if (!selected || !preview) return;
    onAdd({
      id: createId('media'),
      kind: 'image',
      src: preview,
      alt: selected.title,
      caption: selected.title,
      name: `${selected.id}.svg`,
    });
    onClose?.();
  };

  return (
    <div className="section-media-templates">
      <div className="mt-2 grid gap-3 rounded-lg border border-walnut/12 bg-ivory/90 p-3 lg:grid-cols-2">
          <section>
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium text-forest">{t('templates.manual')}</h4>
              <span className="text-[11px] text-walnut/70">{t('templates.chooseRecipe')}</span>
            </div>
            <select
              className="mt-2 w-full rounded-md border border-walnut/15 bg-cream px-2 py-1.5 text-xs"
              value={selected?.id ?? ''}
              onChange={(event) => chooseTemplate(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                  {template.animated ? ` ${t('templates.animated')}` : ''}
                </option>
              ))}
            </select>

            {selected ? (
              <div className="mt-2 grid gap-2">
                {selected.params.map((spec) => (
                  <ParamField
                    key={spec.key}
                    spec={spec}
                    value={params[spec.key]}
                    onChange={(value) => {
                      setParams((current) => ({ ...current, [spec.key]: value }));
                      setPreview(null);
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-forest/20 bg-forest px-3 py-1.5 text-xs font-medium text-cream"
                onClick={renderPreview}
              >
                {t('templates.previewFigure')}
              </button>
              <button
                type="button"
                className="rounded-md border border-brass/40 bg-cream px-3 py-1.5 text-xs font-medium text-forest disabled:opacity-50"
                disabled={!preview}
                onClick={attachPreview}
              >
                {t('templates.addToSection')}
              </button>
            </div>
            {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
          </section>

          <section className="rounded-md border border-brass/25 bg-cream/60 p-3">
            <h4 className="text-sm font-medium text-forest">{t('templates.webmcp')}</h4>
            <p className="mt-1 text-xs leading-relaxed text-walnut">{t('templates.webmcpBody')}</p>
            <p className="mt-3 rounded-md border border-brass/20 bg-ivory px-2 py-1.5 text-xs text-walnut">
              {t('templates.webmcpPrompt', { title: selected?.title ?? 'figure' })}
            </p>
            <p className="mt-3 text-[11px] text-walnut/75">
              <span className="font-mono">lectern_list_media_templates</span> →{' '}
              <span className="font-mono">lectern_generate_section_media</span>
            </p>
          </section>

          {preview ? (
            <div className="lg:col-span-2">
              <p className="mb-1 text-xs font-medium text-forest">{t('templates.preview')}</p>
              <img className="w-full rounded-md border border-walnut/12 bg-cream" src={preview} alt={t('templates.previewAlt')} />
            </div>
          ) : null}
      </div>
    </div>
  );
}

function ParamField({
  spec,
  value,
  onChange,
}: {
  spec: MediaTemplateParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  if (spec.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-walnut">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {spec.description}
      </label>
    );
  }

  const isList = spec.type === 'string[]' || spec.type === 'number[]';
  const textValue = isList ? (Array.isArray(value) ? value.join(', ') : '') : String(value ?? '');
  return (
    <label className="block text-xs text-walnut">
      <span>
        {spec.description}
        {spec.required ? ' *' : ''}
      </span>
      <input
        className="mt-1 w-full rounded-md border border-walnut/15 bg-cream px-2 py-1 text-xs outline-none focus:border-brass"
        placeholder={isList ? t('templates.commaHint') : spec.example === undefined ? spec.key : String(spec.example)}
        type={spec.type === 'number' ? 'number' : 'text'}
        value={textValue}
        onChange={(event) => onChange(parseValue(event.target.value, spec.type))}
      />
    </label>
  );
}

function defaultParams(template?: MediaTemplateDefinition): Record<string, unknown> {
  return Object.fromEntries(
    (template?.params ?? []).map((spec) => [
      spec.key,
      spec.example ?? (spec.type === 'string[]' || spec.type === 'number[]' ? [] : spec.type === 'boolean' ? false : ''),
    ]),
  );
}

function parseValue(value: string, type: MediaTemplateParamSpec['type']): unknown {
  if (type === 'number') return value === '' ? '' : Number(value);
  if (type === 'string[]') return value.split(',').map((item) => item.trim()).filter(Boolean);
  if (type === 'number[]') return value.split(',').map(Number).filter((item) => Number.isFinite(item));
  return value;
}
