import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '登入失敗';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const errorStyle = (): string => {
    if (!error) return 'hidden';
    if (error.includes('locked')) return 'bg-red-50 text-red-700';
    if (error.includes('pending')) return 'bg-yellow-50 text-yellow-700';
    return 'bg-red-50 text-red-600';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold text-gray-900">登入</h1>
          <p className="text-sm text-gray-400 mt-1">ERP 自動編碼系統</p>
        </CardHeader>
        <CardBody>
          {error && (
            <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${errorStyle()}`}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <Input
              label="帳號或 Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="請輸入帳號或 Email"
              required
            />
            <Input
              label="密碼"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
            />
            <Button type="submit" loading={loading} className="w-full mt-1">
              登入
            </Button>
          </form>
          <div className="text-center text-sm mt-4 space-y-2">
            <p>
              <Link to="/register" className="text-blue-600 hover:underline">建立帳號</Link>
            </p>
            <p>
              <Link to="/forgot-password" className="text-gray-400 text-xs hover:text-blue-600">忘記密碼？</Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
