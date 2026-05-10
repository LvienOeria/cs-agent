import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p','br','strong','em','code','pre','ul','ol','li','a',
  'blockquote','h1','h2','h3','h4','h5','h6','hr',
  'table','thead','tbody','tr','th','td','img',
];

const ALLOWED_ATTR = ['href','src','alt','title','target','rel'];

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS, ALLOWED_ATTR });
}
