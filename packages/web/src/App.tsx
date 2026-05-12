import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThread } from './hooks/useThread';
import Layout from './components/Layout';
import Home from './pages/Home';
import Quiz from './pages/Quiz';

export default function App() {
  const thread = useThread();

  return (
    <BrowserRouter>
      <Layout thread={thread}>
        <Routes>
          <Route path="/" element={<Home key={thread.threadId} />} />
          <Route path="/quiz/:sessionId" element={<Quiz threadId={thread.threadId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
