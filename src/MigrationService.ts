import { collection, getDocs, writeBatch, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { Company } from './types';

export const migrateToDemoCompany = async () => {
  const DEMO_COMPANY_ID = 'demo-sl';
  const DEMO_COMPANY_NAME = 'Demo SL';

  // 1. Create Demo Company if it doesn't exist
  const companyRef = doc(db, 'companies', DEMO_COMPANY_ID);
  await setDoc(companyRef, {
    id: DEMO_COMPANY_ID,
    name: DEMO_COMPANY_NAME,
    createdAt: new Date().toISOString()
  }, { merge: true });

  const collectionsToMigrate = [
    'users',
    'teams',
    'processes',
    'tasks',
    'criteria',
    'userTaskLevels',
    'trainingActions',
    'teamTargets'
  ];

  for (const colName of collectionsToMigrate) {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((document) => {
      const data = document.data();
      // Only migrate if companyId is missing
      if (!data.companyId) {
        batch.update(document.ref, { companyId: DEMO_COMPANY_ID });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Migrated ${count} documents in ${colName}`);
    }
  }
};
