import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface ApiError {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    setFieldErrors({});
    setSuccess('');

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: '密碼不一致' });
      return;
    }

    setLoading(true);
    try {
      const msg = await register(username, email, password);
      setSuccess(msg);
      setCountdown(5);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg = apiErr?.response?.data?.message;
      const errs = apiErr?.response?.data?.errors;

      if (errs) {
        const flat: Record<string, string> = {};
        for (const [field, messages] of Object.entries(errs)) {
          flat[field] = messages[0];
        }
        setFieldErrors(flat);
        setError(msg || Object.values(flat)[0] || '註冊失敗');
      } else {
        setError(msg || '註冊失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <h1 className="text-xl font-semibold text-gray-900">註冊已送出</h1>
          </CardHeader>
          <CardBody>
            <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
              {success}
            </div>
            <p className="text-center text-sm text-gray-400">
              {countdown} 秒後自動跳轉至登入頁面...
            </p>
            <p className="text-center text-sm mt-4">
              <Link to="/login" className="text-blue-600 hover:underline">立即前往登入</Link>
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
          <h1 className="text-xl font-semibold text-gray-900">建立帳號</h1>
          <p className="text-sm text-gray-400 mt-1">註冊 ERP 自動編碼系統</p>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <Input
              label="帳號"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請選擇帳號"
              error={fieldErrors.username}
              required
              minLength={2}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入 Email"
              error={fieldErrors.email}
              required
            />
            <Input
              label="密碼"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 個字元"
              error={fieldErrors.password}
              required
              minLength={8}
            />
            <Input
              label="確認密碼"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次輸入密碼"
              error={fieldErrors.confirmPassword}
              required
            />
            <Button type="submit" loading={loading} className="w-full mt-1">
              註冊
            </Button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-5">
            已經有帳號？{' '}
            <Link to="/login" className="text-blue-600 hover:underline">登入</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
