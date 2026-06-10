import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import client from '../api/client';

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await client.post('/auth/forgot-password', { identifier });
      setSuccess(data.message || '請求已送出');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '送出失敗';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold text-gray-900">忘記密碼</h1>
          <p className="text-sm text-gray-400 mt-1">請輸入您的帳號或 Email</p>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
          )}
          {success ? (
            <>
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>
              <p className="text-center text-sm mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">返回登入</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <Input
                label="帳號或 Email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="請輸入您的帳號或 Email"
                required
              />
              <Button type="submit" loading={loading} className="w-full mt-1">
                送出請求
              </Button>
              <p className="text-center text-sm mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">返回登入</Link>
              </p>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
