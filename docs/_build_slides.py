"""Convert docs/slides.md to docs/slides.pdf as 16:9 landscape slides.

Each `---` Markdown separator becomes a new slide (= new page).
"""
from __future__ import annotations

import re
from pathlib import Path

import markdown
from weasyprint import HTML

HERE = Path(__file__).parent
MD = HERE / "slides.md"
PDF = HERE / "slides.pdf"

CSS = """
@page {
  size: 280mm 157mm;  /* roughly 16:9 landscape */
  margin: 12mm 16mm;
  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-size: 9pt;
    color: #888;
  }
  @bottom-left {
    content: "quizz-cours-IA — Module 11";
    font-size: 9pt;
    color: #888;
  }
}
body {
  font-family: "DejaVu Sans", "Liberation Sans", Helvetica, Arial, sans-serif;
  font-size: 14pt;
  line-height: 1.45;
  color: #1f2328;
  margin: 0;
}
.slide {
  page-break-after: always;
  padding: 0;
  min-height: 130mm;
}
.slide:last-child { page-break-after: auto; }

.slide.lead {
  text-align: center;
  padding-top: 30mm;
}
.slide.lead h1 {
  font-size: 38pt;
  border: none;
  margin: 0 0 10mm 0;
  color: #0d1117;
}
.slide.lead h2 {
  font-size: 22pt;
  color: #57606a;
  border: none;
  margin: 0 0 5mm 0;
}
.slide.lead h3 {
  font-size: 16pt;
  color: #57606a;
  font-weight: 400;
  margin: 0 0 18mm 0;
}
.slide.lead strong {
  display: block;
  font-size: 14pt;
  margin-bottom: 16mm;
  color: #0d1117;
}

h1 {
  font-size: 22pt;
  color: #0d1117;
  margin: 0 0 8mm 0;
  padding-bottom: 4px;
  border-bottom: 3px solid #0d1117;
}
h2 {
  font-size: 16pt;
  color: #0d1117;
  margin: 8mm 0 4mm 0;
}
h3 {
  font-size: 13pt;
  color: #0d1117;
  margin: 6mm 0 3mm 0;
}
p { margin: 4mm 0; }
ul, ol { margin: 4mm 0 4mm 8mm; }
li { margin: 2mm 0; }
strong { color: #0d1117; }
em { color: #0969da; font-style: normal; font-weight: 600; }

code {
  font-family: "DejaVu Sans Mono", "Liberation Mono", Menlo, monospace;
  background: #f6f8fa;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11pt;
}
pre {
  background: #f6f8fa;
  padding: 8mm;
  border-radius: 4px;
  font-size: 9.5pt;
  white-space: pre-wrap;
  line-height: 1.3;
}
pre code { background: transparent; padding: 0; font-size: 9.5pt; }

table {
  border-collapse: collapse;
  width: 100%;
  margin: 4mm 0;
  font-size: 11pt;
}
th, td {
  border: 1px solid #d1d9e0;
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
}
th { background: #f6f8fa; font-weight: 600; }

blockquote {
  border-left: 4px solid #0969da;
  padding-left: 6mm;
  color: #1f2328;
  font-size: 14pt;
  margin: 5mm 0;
  font-style: italic;
}

hr { display: none; }
"""

YAML_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
SLIDE_DIRECTIVE_RE = re.compile(r"<!--\s*_class:\s*(\w+)\s*-->")


def strip_front_matter(text: str) -> str:
    m = YAML_RE.match(text)
    return text[m.end() :] if m else text


def split_slides(text: str) -> list[str]:
    """Split on lines that contain only '---' (Markdown HR == slide break)."""
    parts: list[str] = []
    buf: list[str] = []
    for line in text.splitlines():
        if line.strip() == "---":
            if buf:
                parts.append("\n".join(buf).strip())
                buf = []
        else:
            buf.append(line)
    if buf:
        parts.append("\n".join(buf).strip())
    return [p for p in parts if p]


def render_slide(raw: str) -> str:
    """Render one slide markdown into an HTML <section>."""
    # Detect Marp-style class directive (e.g. <!-- _class: lead -->)
    cls = ""
    m = SLIDE_DIRECTIVE_RE.search(raw)
    if m:
        cls = m.group(1)
    # Strip all <!-- _xxx --> directives before rendering
    cleaned = re.sub(r"<!--\s*_\w+:.*?-->\s*", "", raw)
    html_inner = markdown.markdown(
        cleaned,
        extensions=["extra", "tables", "fenced_code"],
    )
    class_attr = f"slide {cls}".strip()
    return f'<section class="{class_attr}">{html_inner}</section>'


def main() -> None:
    raw = MD.read_text(encoding="utf-8")
    body = strip_front_matter(raw)
    slides = split_slides(body)
    sections = "\n".join(render_slide(s) for s in slides)

    html_doc = (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{CSS}</style></head><body>"
        + sections
        + "</body></html>"
    )

    HTML(string=html_doc, base_url=str(HERE)).write_pdf(str(PDF))
    print(f"Slides PDF generated: {PDF} ({len(slides)} slides)")


if __name__ == "__main__":
    main()
