export type LecternMediaId = 'draft' | 'copilot' | 'publish' | 'student' | 'mark';

export const LECTERN_MEDIA: Record<
  LecternMediaId,
  { src: string; alt: string; title: string; blurb: string; imageClass?: string }
> = {
  draft: {
    src: '/media/cta-draft.png?v=3',
    alt: 'Wooden lectern with open lesson pages',
    title: 'Draft',
    blurb: 'Write materials and tests on the page.',
  },
  copilot: {
    src: '/media/cta-copilot.png?v=2',
    alt: 'Lesson page with co-pilot attention on a passage',
    title: 'Co-pilot',
    blurb: 'Ask WebMCP to fill gaps and harden the lesson.',
  },
  publish: {
    src: '/media/cta-publish.png?v=2',
    alt: 'Published lesson ready to share',
    title: 'Publish',
    blurb: 'Send students a read-only copy.',
  },
  student: {
    src: '/media/cta-student.png?v=2',
    alt: 'Student reading an open lesson at a wooden desk',
    title: 'Read',
    blurb: 'Read the materials and try the checks.',
  },
  mark: {
    src: '/media/cta-mark.png?v=1',
    alt: 'Hand leaving a margin note on an open lesson at a lectern',
    title: 'Mark',
    blurb: 'Leave a learned mark or a note in the margin.',
  },
};
