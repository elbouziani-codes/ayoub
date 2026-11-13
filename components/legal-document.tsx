import Link from "next/link";
import type { LegalSection, LocalizedLegalDocument } from "@/lib/legal";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return <>{parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
    return match ? <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a> : part;
  })}</>;
}

function SectionBody({ section }: { section: LegalSection }) {
  const lines = section.body.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: React.ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    if (/^[-*]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) items.push(lines[index++].replace(/^[-*]\s+/, ""));
      blocks.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) items.push(lines[index++].replace(/^\d+[.)]\s+/, ""));
      blocks.push(<ol key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</ol>);
      continue;
    }
    if (lines[index].startsWith("|") && lines[index].endsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].startsWith("|") && lines[index].endsWith("|")) {
        const cells = lines[index++].slice(1, -1).split("|").map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-+:?$/.test(cell))) rows.push(cells);
      }
      if (rows.length) blocks.push(<div className="legal-table-wrap" key={`table-${index}`}><table><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}><Inline text={cell} /></th> : <td key={cellIndex}><Inline text={cell} /></td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    blocks.push(<p key={`p-${index}`}><Inline text={lines[index++]} /></p>);
  }
  return <div className="legal-section-body">{blocks}</div>;
}

export default function LegalDocument({ document, version, publishedAt }: { document: LocalizedLegalDocument; version?: number; publishedAt?: string | null }) {
  return <article className="legal-document">
    <header><h1>{document.title}</h1>{version && <p className="legal-version">Version {version}{publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString()}` : ""}</p>}</header>
    {document.sections.map((section) => <section id={section.id} key={section.id}><h2>{section.heading}</h2><SectionBody section={section} /></section>)}
    <p className="legal-back"><Link href="/">← Ayoub Shop</Link></p>
  </article>;
}
