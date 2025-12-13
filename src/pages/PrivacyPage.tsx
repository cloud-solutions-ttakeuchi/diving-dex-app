import React from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacyPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 pb-32">
      <div className="text-center mb-12">
        <Lock size={48} className="mx-auto text-green-600 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
        <p className="text-gray-500">最終更新日: 2025年12月13日</p>
      </div>

      <div className="prose prose-green max-w-none bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3>1. 個人情報の収集</h3>
        <p>当アプリでは、Googleアカウントを使用したログイン時に、メールアドレス、プロフィール名、アイコン画像を取得します。また、ユーザーがアップロードしたダイビングログデータ（位置情報、写真、深度データ等）をサーバーに保存します。</p>

        <h3>2. 利用目的</h3>
        <p>収集した情報は、以下の目的で利用します。</p>
        <ul>
          <li>本サービスの提供・運営のため</li>
          <li>ユーザーからのお問い合わせに回答するため</li>
          <li>重要なお知らせなど必要に応じたご連絡のため</li>
        </ul>

        <h3>3. 第三者への提供</h3>
        <p>当社は、法令に基づく場合を除き、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。</p>

        <h3>4. データの保護</h3>
        <p>ユーザーのデータは、適切に管理されたデータベース（Google Cloud Platform / Firebase）に保存され、セキュリティ対策を講じています。</p>

        <h3>5. お問い合わせ</h3>
        <p>本ポリシーに関するお問い合わせは、運営者までご連絡ください。</p>

        <hr className="my-8" />

        <div className="text-center pt-4">
          <Link to="/" className="text-green-600 font-bold hover:underline">ホームに戻る</Link>
        </div>
      </div>
    </div>
  );
};
