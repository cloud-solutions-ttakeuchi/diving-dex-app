import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, X, MapPin, Fish, Database, Award } from 'lucide-react';
import { seedFirestore } from '../utils/seeder';
import { TRUST_RANKS } from '../data/mockData';

export const AdminProposalsPage = () => {
  const { proposalCreatures, proposalPoints, approveProposal, rejectProposal, currentUser, isAuthenticated, allUsers, creatures, points, pointCreatures, removePointCreature, addPointCreature } = useApp();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Filter deletion and addition requests
  const deletionRequests = pointCreatures.filter(pc => pc.status === 'deletion_requested');
  const additionRequests = pointCreatures.filter(pc => pc.status === 'pending');

  // Check Admin Role
  if (!isAuthenticated || (currentUser.role !== 'admin' && currentUser.role !== 'moderator')) {
    return <div className="p-10 text-center">Access Denied</div>;
  }

  // Custom handlers for point-creature relationships
  const handleApproveAddition = async (req: any) => {
    if (!window.confirm('この生物の追加を承認しますか？')) return;
    setProcessingId(req.id);
    // Re-add as admin to force 'approved' status (or just update status)
    // Using addPointCreature logic which handles 'approved' for admins
    await addPointCreature(req.pointId, req.creatureId, req.localRarity);
    setProcessingId(null);
  }

  const handleRejectAddition = async (req: any) => {
    if (!window.confirm('この生物の追加を却下（削除）しますか？')) return;
    setProcessingId(req.id);
    // Rejecting an addition means deleting the pending record
    await removePointCreature(req.pointId, req.creatureId);
    setProcessingId(null);
  }

  const handleApproveDeletion = async (req: any) => {
    if (!window.confirm('削除リクエストを承認（完全に削除）しますか？')) return;
    setProcessingId(req.id);
    await removePointCreature(req.pointId, req.creatureId);
    setProcessingId(null);
  }

  const handleRejectDeletion = async (req: any) => {
    if (!window.confirm('削除リクエストを却下（元に戻す）しますか？')) return;
    setProcessingId(req.id);
    // Revert status to approved
    await addPointCreature(req.pointId, req.creatureId, req.localRarity);
    setProcessingId(null);
  }


  const handleForceSeed = async () => {
    // Extra safety check
    if (currentUser.role !== 'admin') {
      alert('権限がありません。');
      return;
    }
    if (!window.confirm('【注意】マスタデータを強制更新してもよろしいですか？\n\n・新しい生物やポイントがFirestoreに追加/更新されます。\n・ユーザーデータや提案データには影響しません。\n・この操作は取り消せません。')) return;

    setIsSeeding(true);
    try {
      const success = await seedFirestore(true);
      if (success) {
        alert('マスタデータの更新が完了しました！');
      } else {
        alert('更新中にエラーが発生しました。コンソールを確認してください。');
      }
    } catch (e) {
      console.error(e);
      alert('予期せぬエラーが発生しました。');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleApprove = async (type: 'creature' | 'point', item: any) => {
    const action = item.proposalType === 'update' ? '変更を承認' : '新規登録を承認';
    if (!window.confirm(`${action}してもよろしいですか？`)) return;
    setProcessingId(item.id);
    await approveProposal(type, item.id, item, item.submitterId);
    setProcessingId(null);
  };

  const handleReject = async (type: 'creature' | 'point', id: string) => {
    if (!window.confirm('却下してもよろしいですか？')) return;
    setProcessingId(id);
    await rejectProposal(type, id);
    setProcessingId(null);
  };

  const getSubmitterInfo = (submitterId: string) => {
    const user = allUsers.find(u => u.id === submitterId);
    if (!user) return <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-400">Unknown Submitter (ID: {submitterId})</div>;

    const currentScore = user.trustScore || 0;
    const rank = TRUST_RANKS.slice().reverse().find(r => currentScore >= r.minScore) || TRUST_RANKS[0];

    return (
      <div className="flex items-center gap-2 mt-3 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-white shadow-sm">
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">{user.name.charAt(0)}</div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{user.name}</span>
            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border shadow-sm ${rank.designColor.replace('text', 'border').replace('500', '200')} bg-white`}>
              <Award size={10} className={rank.designColor} />
              {rank.name}
            </span>
            {user.role !== 'user' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {user.role === 'admin' ? 'ADMIN' : 'MOD'}
              </span>
            )}
          </div>
          <div className="text-xs text-indigo-600 font-medium mt-0.5">Trust Score: {currentScore}</div>
        </div>
      </div>
    );
  };

  const renderDiff = (proposal: any, type: 'creature' | 'point') => {
    const list = type === 'creature' ? creatures : points;
    const original = list.find((i: any) => i.id === proposal.targetId);

    if (!original) return <div className="text-red-500 text-sm">Target ID not found: {proposal.targetId}</div>;

    const diff = proposal.diffData || {};

    return (
      <div className="mt-3 bg-yellow-50 rounded-lg border border-yellow-200 p-3 text-sm">
        <div className="font-bold text-yellow-800 mb-2 flex items-center gap-1">
          ⚠️ 変更内容 (対象: {original.name})
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {Object.keys(diff).map(key => {
            const oldValue = (original as any)[key];
            const newValue = diff[key];

            // Format arrays for display
            const displayOld = Array.isArray(oldValue) ? oldValue.join(', ') : String(oldValue);
            const displayNew = Array.isArray(newValue) ? newValue.join(', ') : String(newValue);

            return (
              <div key={key} className="contents">
                <div className="font-bold text-gray-500 text-right">{key}:</div>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div className="text-gray-400 line-through bg-white px-2 py-0.5 rounded border border-gray-100">{displayOld}</div>
                  <div className="text-gray-400">→</div>
                  <div className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-green-200">{displayNew}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Context Preview (for images) */}
        {diff.imageUrl && (
          <div className="mt-2 flex gap-4">
            <div className="w-16 h-16 opacity-50"><img src={(original as any).imageUrl} className="w-full h-full object-cover rounded" /></div>
            <div className="text-2xl text-gray-400">→</div>
            <div className="w-16 h-16 border-2 border-green-500 rounded"><img src={diff.imageUrl} className="w-full h-full object-cover rounded" /></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-32">
      <div className="flex justify-between items-center max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-gray-800">提案管理ダッシュボード</h1>

        {/* Admin Utils */}
        <div className="flex gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={handleForceSeed}
              disabled={isSeeding}
              className="flex items-center gap-2 text-xs bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Database size={14} />
              {isSeeding ? '更新中...' : 'マスタデータ強制同期'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto mb-8">
        <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">承認待ちリスト</h2>
        {proposalCreatures.length === 0 && proposalPoints.length === 0 && (
          <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-300">
            承認待ちの項目はありません
          </div>
        )}
      </div>

      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Creatures */}
        {proposalCreatures.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Fish className="text-blue-500" /> 生物提案 ({proposalCreatures.length})</h2>
            <div className="grid gap-4">
              {proposalCreatures.map(c => {
                const isUpdate = c.proposalType === 'update';
                return (
                  <div key={c.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                      <img src={isUpdate && c.diffData?.imageUrl ? c.diffData.imageUrl : c.imageUrl} className="w-full h-full object-cover" alt={c.name} />
                    </div>
                    <div className="flex-1 py-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-gray-900">
                          {isUpdate ? (creatures.find(x => x.id === c.targetId)?.name || 'Unknown') : c.name}
                          {isUpdate && <span className="text-sm font-normal text-gray-500 ml-2">(ID: {c.targetId})</span>}
                          {!isUpdate && <span className="text-sm font-normal text-gray-500 ml-2">({c.scientificName})</span>}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${isUpdate ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                          {isUpdate ? '変更提案' : '新規登録'}
                        </span>
                      </div>

                      {isUpdate ? (
                        renderDiff(c, 'creature')
                      ) : (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.description}</p>
                      )}

                      {/* Submitter Info Highlight */}
                      {getSubmitterInfo(c.submitterId || '')}

                      {!isUpdate && (
                        <div className="mt-3 flex gap-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Category: {c.category}</span>
                          <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Rarity: {c.rarity}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                      <button
                        onClick={() => handleApprove('creature', c)}
                        disabled={processingId === c.id}
                        className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <Check size={16} /> 承認 <span className="text-xs opacity-90">(+5 TP)</span>
                      </button>
                      <button
                        onClick={() => handleReject('creature', c.id)}
                        disabled={processingId === c.id}
                        className="flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <X size={16} /> 却下
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Addition Requests (Pending) */}
        {
          additionRequests.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600"><Check className="text-blue-500" /> 追加リクエスト ({additionRequests.length})</h2>
              <div className="grid gap-4">
                {additionRequests.map(req => {
                  const targetPoint = points.find(p => p.id === req.pointId);
                  const targetCreature = creatures.find(c => c.id === req.creatureId);
                  return (
                    <div key={req.id} className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex flex-col md:flex-row gap-6 items-center">

                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                        <img src={targetCreature?.imageUrl} className="w-full h-full object-cover" alt={targetCreature?.name} />
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {targetCreature?.name} <span className="text-sm font-normal text-gray-500">at</span> {targetPoint?.name}
                        </h3>
                        <div className="mt-1 flex gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded border ${req.localRarity === 'Common' ? 'bg-gray-100 border-gray-300 text-gray-600' :
                            req.localRarity === 'Rare' ? 'bg-blue-100 border-blue-300 text-blue-600' :
                              'bg-purple-100 border-purple-300 text-purple-600'}`}>
                            {req.localRarity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">追加申請されています</p>
                        {/* {getSubmitterInfo(req.submitterId || '')} // Submitter info logic needs to track who submitted */}
                      </div>

                      <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                        <button
                          onClick={() => handleApproveAddition(req)}
                          disabled={processingId === req.id}
                          className="flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check size={16} /> 承認
                        </button>
                        <button
                          onClick={() => handleRejectAddition(req)}
                          disabled={processingId === req.id}
                          className="flex items-center justify-center gap-2 bg-white text-gray-600 border border-gray-200 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <X size={16} /> 却下
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        }

        {/* Deletion Requests */}
        {
          deletionRequests.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-600"><X className="text-red-500" /> 削除リクエスト ({deletionRequests.length})</h2>
              <div className="grid gap-4">
                {deletionRequests.map(req => {
                  const targetPoint = points.find(p => p.id === req.pointId);
                  const targetCreature = creatures.find(c => c.id === req.creatureId);
                  return (
                    <div key={req.id} className="bg-white p-6 rounded-xl shadow-sm border border-red-100 flex flex-col md:flex-row gap-6 items-center">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {targetCreature?.name} <span className="text-sm font-normal text-gray-500">at</span> {targetPoint?.name}
                        </h3>
                        <p className="text-sm text-gray-500">削除申請されています</p>
                      </div>
                      <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                        <button
                          onClick={() => handleApproveDeletion(req)}
                          disabled={processingId === req.id}
                          className="flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <X size={16} /> 削除実行
                        </button>
                        <button
                          onClick={() => handleRejectDeletion(req)}
                          disabled={processingId === req.id}
                          className="flex items-center justify-center gap-2 bg-white text-gray-600 border border-gray-200 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check size={16} /> 却下(維持)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        }          {/* We need updatePointCreature? Or just use addPointCreature logic?
                            // Actually we can just updateDoc directly if we had a function...
                            // Or call addPointCreature which sets to approved/pending.
                            // Since it's admin doing this rejection, calling addPointCreature will set it to 'approved'.
                            // But we need to keep the original Rarity?
                            // Let's use addPointCreature(pointId, creatureId, req.localRarity) -> status='approved' (Admin)
                            await addPointCreature(req.pointId, req.creatureId, req.localRarity);
                          }}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"
                        >
                          却下 (復元)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        }

        {/* Points */}
        {
          proposalPoints.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-green-500" /> ポイント提案 ({proposalPoints.length})</h2>
              <div className="grid gap-4">
                {proposalPoints.map(p => {
                  const isUpdate = p.proposalType === 'update';
                  return (
                    <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6">
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                        <img src={isUpdate && p.diffData?.imageUrl ? p.diffData.imageUrl : p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                      </div>
                      <div className="flex-1 py-1">
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-bold text-gray-900">
                            {isUpdate ? (points.find(x => x.id === p.targetId)?.name || 'Unknown') : p.name}
                            {isUpdate && <span className="text-sm font-normal text-gray-500 ml-2">(ID: {p.targetId})</span>}
                            {!isUpdate && <span className="text-sm font-normal text-gray-500 ml-2">in {p.area}, {p.zone}</span>}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isUpdate ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                            {isUpdate ? '変更提案' : '新規登録'}
                          </span>
                        </div>

                        {isUpdate ? (
                          renderDiff(p, 'point')
                        ) : (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
                        )}

                        {/* Submitter Info Highlight */}
                        {getSubmitterInfo(p.submitterId)}

                        {!isUpdate && (
                          <div className="mt-3 flex gap-2 text-xs text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Level: {p.level}</span>
                            <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">Depth: {p.maxDepth}m</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                        <button
                          onClick={() => handleApprove('point', p)}
                          disabled={processingId === p.id}
                          className="flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check size={16} /> 承認 <span className="text-xs opacity-90">(+5 TP)</span>
                        </button>
                        <button
                          onClick={() => handleReject('point', p.id)}
                          disabled={processingId === p.id}
                          className="flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-bold hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <X size={16} /> 却下
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        }
      </div>
    </div>
  );
};
