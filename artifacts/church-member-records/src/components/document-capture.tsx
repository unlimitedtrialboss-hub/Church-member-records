import { useState } from 'react';
import { Camera, FileText, Loader2 } from 'lucide-react';
import type { MemberInput } from '@workspace/api-client-react';

function extractFields(text: string): Partial<MemberInput> {
  const fields: Partial<MemberInput> = {};
  const aliases: Record<string, keyof MemberInput> = { name: 'name', 'full name': 'name', address: 'address', 'contact number': 'contactNumber', phone: 'contactNumber', gender: 'gender', 'birth date': 'birthDate', birthdate: 'birthDate', 'birth place': 'birthPlace', birthplace: 'birthPlace', citizenship: 'citizenship', 'civil status': 'civilStatus', spouse: 'spouse', father: 'father', mother: 'mother', 'church position': 'churchPosition', 'special skills': 'specialSkills', 'date of baptism': 'dateOfBaptism', 'date of membership': 'dateOfMembership', 'date of salvation': 'dateOfSalvation', 'emergency contact person': 'emergencyContactPerson', 'emergency contact number': 'emergencyContactNumber', 'emergency contact address': 'hisHerAddress', 'other ministry': 'otherMinistry', 'elementary school': 'elementarySchool', 'high school': 'highSchool', college: 'college', 'degree course': 'degreeCourse' };
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = aliases[line.slice(0, separator).trim().toLowerCase()];
    const value = line.slice(separator + 1).trim();
    if (key && value) (fields as Record<string, unknown>)[key] = value;
  }
  return fields;
}

export function DocumentCapture({ onExtract }: { onExtract: (fields: Partial<MemberInput>) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const capture = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage('Reading document…');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const result = await worker.recognize(file);
      await worker.terminate();
      const fields = extractFields(result.data.text);
      onExtract(fields);
      setMessage(Object.keys(fields).length ? `Filled ${Object.keys(fields).length} labeled fields. Review before saving.` : 'No labeled fields recognized. Use labels like Name: and Address:.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this document.'); }
    finally { setBusy(false); }
  };
  return <div className="rounded-xl border border-primary/20 bg-primary/[.04] p-3"><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110"><Camera size={15} />{busy ? 'Reading…' : 'Scan document'}<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(event) => { void capture(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText size={14} />OCR stays in your browser</span>{busy && <Loader2 className="animate-spin text-primary" size={15} />}</div>{message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}</div>;
}