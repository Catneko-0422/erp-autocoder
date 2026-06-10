import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { authApi } from '../api/client';

export function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!success) return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
    navigate('/login', { replace: true });
  }, [success, countdown, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('新密碼不一致');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      await refreshUser();
      setSuccess('密碼變更成功');
      setCountdown(3);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '密碼變更失敗';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <h1 className="text-xl font-semibold text-gray-900">密碼已更新</h1>
          </CardHeader>
          <CardBody>
            <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
              {success}
            </div>
            <p className="text-center text-sm text-gray-400">
              {countdown} 秒後請使用新密碼重新登入...
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold text-gray-900">變更密碼</h1>
          {user?.must_change_password && (
            <p className="text-sm text-amber-600 mt-2">
              您必須先變更密碼才能繼續。
            </p>
          )}
        </CardHeader>
        <CardBody>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <Input
              label="目前密碼"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
            <Input
              label="新密碼"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 8 個字元"
              required
              minLength={8}
            />
            <Input
              label="確認新密碼"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full mt-1">
              更新密碼
            </Button>
          </form>
          {!user?.must_change_password && (
            <p className="text-center text-sm mt-4">
              <button type="button" className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => navigate('/', { replace: true })}>
                返回首頁
              </button>
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
