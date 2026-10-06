import { PATCH_NOTES } from '../lib/patchNotes'

const longDate = (iso) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
}).format(new Date(`${iso}T12:00:00Z`))

// What changed in the bots and on this site, newest first. The content lives
// in lib/patchNotes.js so a new entry is an edit to a list, not to this page.
export default function PatchNotes() {
  return (
    <div className="notes">
      {PATCH_NOTES.map((entry) => (
        <section key={entry.date + entry.title} className="panel">
          <header className="panel-head">
            <div>
              <h2>{entry.title}</h2>
              <p className="muted"><time dateTime={entry.date}>{longDate(entry.date)}</time></p>
            </div>
          </header>
          <div className="notes-body">
            {entry.sections.map((sec) => (
              <div key={sec.heading} className="notes-section">
                <h3>{sec.heading}</h3>
                {sec.text && <p>{sec.text}</p>}
                {sec.table && (
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>{sec.table.head.map((h, i) => (
                          <th key={h} scope="col" className={i ? 'num' : ''}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {sec.table.rows.map((row) => (
                          <tr key={row[0]}>{row.map((cell, i) => (
                            <td key={i} className={i ? 'num' : ''}>{cell}</td>
                          ))}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sec.bullets && (
                  <ul>{sec.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
