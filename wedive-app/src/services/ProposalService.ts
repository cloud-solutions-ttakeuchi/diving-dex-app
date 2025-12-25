import { db } from '../firebase';
import { doc, setDoc, updateDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { Creature, Point, CreatureProposal, PointProposal } from '../types';
import { sanitizePayload } from './LogService';

export class ProposalService {
  /**
   * Submit a creature proposal (create or update)
   */
  static async addCreatureProposal(
    userId: string,
    data: any,
    proposalType: 'create' | 'update' | 'delete',
    targetId?: string
  ): Promise<string> {
    const proposalRef = collection(db, 'creature_proposals');
    const now = new Date().toISOString();

    console.log(`[ProposalService] Submitting creature proposal: type=${proposalType}, targetId=${targetId}`);

    const proposalData: any = {
      proposalType,
      targetId: targetId || "",
      submitterId: userId,
      status: 'pending',
      createdAt: now,
      isDeletionRequest: proposalType === 'delete',
      // Explicit title for easier detection on admin side
      proposalTitle: proposalType === 'delete' ? `【削除申請】${data.name || ''}` :
        proposalType === 'update' ? `【変更申請】${data.name || ''}` :
          `【新規登録】${data.name || ''}`
    };

    if (proposalType === 'create') {
      Object.assign(proposalData, data);
    } else if (proposalType === 'update') {
      proposalData.diffData = data;
      if (data.name) proposalData.name = data.name;
    } else if (proposalType === 'delete') {
      proposalData.diffData = { requestedDeletion: true, ...data };
      if (data.name) proposalData.name = data.name;
    }

    const sanitizedData = sanitizePayload(proposalData);
    console.log("[ProposalService] Final sanitized creature data:", JSON.stringify(sanitizedData, null, 2));
    const docRef = await addDoc(proposalRef, sanitizedData);
    return docRef.id;
  }

  /**
   * Submit a point proposal (create or update)
   */
  static async addPointProposal(
    userId: string,
    data: any,
    proposalType: 'create' | 'update' | 'delete',
    targetId?: string
  ): Promise<string> {
    const proposalRef = collection(db, 'point_proposals');
    const now = new Date().toISOString();

    console.log(`[ProposalService] Submitting point proposal: type=${proposalType}, targetId=${targetId}`);

    const proposalData: any = {
      proposalType,
      targetId: targetId || "",
      submitterId: userId,
      status: 'pending',
      createdAt: now,
      isDeletionRequest: proposalType === 'delete',
      proposalTitle: proposalType === 'delete' ? `【削除申請】${data.name || ''}` :
        proposalType === 'update' ? `【変更申請】${data.name || ''}` :
          `【新規登録】${data.name || ''}`
    };

    if (proposalType === 'create') {
      Object.assign(proposalData, data);
    } else if (proposalType === 'update') {
      proposalData.diffData = data;
      if (data.name) proposalData.name = data.name;
      if (data.region) proposalData.region = data.region;
      if (data.area) proposalData.area = data.area;
      if (data.zone) proposalData.zone = data.zone;
    } else if (proposalType === 'delete') {
      proposalData.diffData = { requestedDeletion: true, ...data };
      if (data.name) proposalData.name = data.name;
      if (data.region) proposalData.region = data.region;
      if (data.area) proposalData.area = data.area;
      if (data.zone) proposalData.zone = data.zone;
    }

    const sanitizedData = sanitizePayload(proposalData);
    console.log("[ProposalService] Final sanitized point data:", JSON.stringify(sanitizedData, null, 2));
    const docRef = await addDoc(proposalRef, sanitizedData);
    return docRef.id;
  }

  /**
   * Admin/Moderator: Approve a proposal
   */
  static async approveCreatureProposal(proposalId: string, proposal: CreatureProposal): Promise<void> {
    const type = proposal.proposalType;
    const targetId = proposal.targetId || `c${Date.now()}`;
    const creatureRef = doc(db, 'creatures', targetId);

    if (type === 'create') {
      const { id, proposalType, targetId: _tid, submitterId, status, createdAt, ...finalData } = proposal;
      await setDoc(creatureRef, sanitizePayload({ ...finalData, id: targetId, status: 'approved' }));
    } else if (type === 'update') {
      await updateDoc(creatureRef, sanitizePayload({ ...proposal.diffData, status: 'approved' }));
    } else if (type === 'delete') {
      // Soft delete
      await updateDoc(creatureRef, { status: 'rejected' });
    }

    await updateDoc(doc(db, 'creature_proposals', proposalId), { status: 'approved' });
  }

  static async approvePointProposal(proposalId: string, proposal: PointProposal): Promise<void> {
    const type = proposal.proposalType;
    const targetId = proposal.targetId || `p${Date.now()}`;
    const pointRef = doc(db, 'points', targetId);

    if (type === 'create') {
      const { id, proposalType, targetId: _tid, submitterId, status, createdAt, ...finalData } = proposal;
      await setDoc(pointRef, sanitizePayload({ ...finalData, id: targetId, status: 'approved' }));
    } else if (type === 'update') {
      await updateDoc(pointRef, sanitizePayload({ ...proposal.diffData, status: 'approved' }));
    } else if (type === 'delete') {
      // Soft delete
      await updateDoc(pointRef, { status: 'rejected' });
    }

    await updateDoc(doc(db, 'point_proposals', proposalId), { status: 'approved' });
  }

  static async rejectProposal(type: 'creature' | 'point', proposalId: string): Promise<void> {
    const colName = type === 'creature' ? 'creature_proposals' : 'point_proposals';
    await updateDoc(doc(db, colName, proposalId), { status: 'rejected' });
  }
}
