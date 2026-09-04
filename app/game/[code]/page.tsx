import { GameClient } from '@/components/game/game-client';

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GameClient code={code === 'demo' ? '4827' : code} />;
}

