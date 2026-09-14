// FRPB — JSON-LD script emitter.
// Renders a structured-data block into the server HTML. `<` is escaped so a
// payload can never terminate the surrounding <script> element early.

export default function JsonLd({
  data,
  id,
}: {
  /** A schema.org object (or graph) to serialise. */
  data: Record<string, unknown> | Record<string, unknown>[];
  /** Optional stable id — helps when several blocks share a page. */
  id?: string;
}) {
  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
