import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TermsPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 pb-32">
      <div className="text-center mb-12">
        <Shield size={48} className="mx-auto text-blue-600 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">利用規約</h1>
        <p className="text-gray-500">最終更新日: 2025年12月13日</p>
      </div>

      <div className="prose prose-blue max-w-none bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3>第1条（適用）</h3>
        <p>本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。</p>

        <h3>第2条（利用登録）</h3>
        <p>登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。</p>

        <h3>第3条（禁止事項）</h3>
        <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ul>
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為</li>
          <li>他人の個人情報などを不正に収集したり蓄積したりする行為</li>
        </ul>

        <h3>第4条（本サービスの提供の停止等）</h3>
        <p>当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</p>

        <h3>第5条（免責事項）</h3>
        <p>当社の債務不履行責任は、当社の故意または重過失によらない場合には免責されるものとします。</p>

        <hr className="my-8" />

        <div className="text-center pt-4">
          <Link to="/" className="text-blue-600 font-bold hover:underline">ホームに戻る</Link>
        </div>
      </div>
    </div>
  );
};
