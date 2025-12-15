import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Camera, Info } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

const initialState = {
  name: '',
  scientificName: '',
  category: 'fish',
  tagsInput: '',
  description: '',
  rarity: 'Common',
  depthMin: '',
  depthMax: '',
  waterTempMin: '',
  waterTempMax: '',
  specialAttributes: [] as string[],
  regions: [] as string[],
  size: '',
  season: [] as string[],
  imageCredit: '',
  imageLicense: '',
  imageUrl: ''
};

export const ProposeCreaturePage = () => {
  const navigate = useNavigate();
  const { addCreatureProposal, isAuthenticated } = useApp();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<any>>(initialState);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <div className="p-8 text-center bg-gray-50 min-h-screen">Please login to propose creatures.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let base64Image = '';
      if (imageFile) {
        base64Image = await compressImage(imageFile);
      }

      const creatureData = {
        name: formData.name,
        scientificName: formData.scientificName,
        category: formData.category,
        description: formData.description,
        rarity: formData.rarity as any,
        imageUrl: base64Image || '/images/no-image.png',
        tags: formData.tagsInput ? formData.tagsInput.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        depthRange: {
          min: Number(formData.depthMin),
          max: Number(formData.depthMax)
        },
        waterTempRange: {
          min: Number(formData.waterTempMin),
          max: Number(formData.waterTempMax)
        },
        specialAttributes: formData.specialAttributes,
        regions: formData.regions,
        size: formData.size,
        imageCredit: formData.imageCredit,
        imageLicense: formData.imageLicense,
      };

      await addCreatureProposal(creatureData);

      alert('提案を送信しました！承認されるまでお待ちください (+1 Trust Score)');
      navigate('/mypage');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('送信に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">新しい生物を提案する</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <h3 className="font-bold mb-1">図鑑への貢献について</h3>
            <p>あなたの知識を図鑑に追加しましょう！提案が承認されると、信頼スコアがアップし、新しいランクへ昇格できます。</p>
          </div>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Info size={20} className="text-blue-500" /> 基本情報
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">生き物の名前 (和名) *</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: カクレクマノミ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学名 (任意)</label>
              <input
                type="text"
                name="scientificName"
                value={formData.scientificName}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                placeholder="例: Amphiprion ocellaris"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none">
                  <option value="fish">魚類</option>
                  <option value="nudibranch">ウミウシ</option>
                  <option value="crustacean">甲殻類</option>
                  <option value="shark">サメ・エイ</option>
                  <option value="turtle">カメ</option>
                  <option value="coral">サンゴ</option>
                  <option value="other">その他</option>
                </select>
              </div>

            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タグ (カンマ区切り)</label>
              <input
                type="text"
                name="tagsInput"
                value={formData.tagsInput}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                placeholder="例: 可愛い, 擬態, 初心者向け"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明文 *</label>
              <textarea
                name="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none resize-none"
                placeholder="特徴や生態について詳しく書いてください..."
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Camera size={20} className="text-green-500" /> 写真
            </h2>

            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Camera className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">クリックしてアップロード</span></p>
                    <p className="text-xs text-gray-500">PNG, JPG (MAX. 5MB)</p>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 ${loading ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-200'}`}
          >
            {loading ? '送信中...' : '提案を送信する (+1 TP)'}
          </button>

        </form>
      </main>
    </div>
  );
};
