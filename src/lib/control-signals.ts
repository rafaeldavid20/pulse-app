import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export function subscribeControlSignal(kind: 'profile' | 'issue', id: string, changed: () => void, failed: () => void) {
  return onSnapshot(doc(db, kind === 'profile' ? 'profile_signals' : 'issue_signals', id), { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache) changed();
  }, () => failed());
}
