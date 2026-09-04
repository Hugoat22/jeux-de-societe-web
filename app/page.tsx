'use client';

import { useState } from 'react';
import { ArrowRight, Radio, Shield, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Home() {
  const [mode, setMode] = useState<'home' | 'join' | 'create'>('home');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');

  const enterGame = (targetCode: string) => {
    const cleanName = nickname.trim() || 'Survivant';
    sessionStorage.setItem('cendre:nickname', cleanName.slice(0, 24));
    window.location.assign(`/game/${targetCode}`);
  };

  const createCode = () => String(Math.floor(1000 + Math.random() * 9000));

  return (
    <main className="min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-7 pt-5 sm:max-w-lg sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" aria-label="Cendre">
            <span className="grid size-9 place-items-center rounded-full border border-primary/30 bg-primary/10">
              <Radio className="size-4 text-primary" />
            </span>
            <span className="font-heading text-sm font-bold tracking-[0.22em]">CENDRE</span>
          </div>
          <Badge variant="outline" className="border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-widest text-muted-foreground">
            PROTOTYPE
          </Badge>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-7">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <span className="h-px w-7 bg-primary/70" />
              Après la chute
            </p>
            <h1 className="max-w-[12ch] font-heading text-[clamp(3.6rem,16vw,5.8rem)] font-black leading-[0.83] tracking-[-0.07em] text-balance">
              Survivre ensemble.
            </h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">
              Les vivres sont comptés. Les choix restent. Et chaque téléphone ne raconte qu’une partie de la vérité.
            </p>
          </div>

          <div className="mb-7 grid grid-cols-3 gap-2">
            {[
              [Users, '3–6', 'survivants'],
              [Shield, '20 min', 'par partie'],
              [Radio, '1', 'issue possible'],
            ].map(([Icon, value, label]) => (
              <div key={String(label)} className="rounded-xl border border-border/70 bg-card/60 px-3 py-3">
                <Icon className="mb-3 size-4 text-primary" />
                <div className="font-mono text-sm font-semibold text-foreground">{String(value)}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{String(label)}</div>
              </div>
            ))}
          </div>

          {mode === 'home' ? (
            <div className="space-y-3">
              <Button className="h-13 w-full justify-between rounded-xl px-5 text-sm font-bold" onClick={() => setMode('create')}>
                Créer une partie
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="h-13 w-full rounded-xl border-white/10 bg-white/[0.03] text-sm" onClick={() => setMode('join')}>
                Rejoindre avec un code
              </Button>
              <Button variant="ghost" className="h-10 w-full text-xs text-muted-foreground" onClick={() => {
                sessionStorage.setItem('cendre:nickname', 'Hugo');
                window.location.assign('/game/demo');
              }}>
                Lancer la démo immédiate
              </Button>
            </div>
          ) : (
            <Card className="border-white/10 bg-card/80 shadow-2xl shadow-black/20">
              <CardContent className="space-y-4 p-5">
                <div>
                  <Label htmlFor="nickname" className="text-xs uppercase tracking-widest text-muted-foreground">Votre prénom</Label>
                  <Input
                    id="nickname"
                    maxLength={24}
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="Hugo"
                    className="mt-2 h-12 border-white/10 bg-black/20"
                    autoFocus
                  />
                </div>
                {mode === 'join' && (
                  <div>
                    <Label htmlFor="code" className="text-xs uppercase tracking-widest text-muted-foreground">Code de la partie</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      maxLength={4}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                      placeholder="4827"
                      className="mt-2 h-14 border-white/10 bg-black/20 text-center font-mono text-2xl tracking-[0.45em]"
                    />
                  </div>
                )}
                <Button
                  disabled={nickname.trim().length < 1 || (mode === 'join' && code.length !== 4)}
                  className="h-12 w-full rounded-xl"
                  onClick={() => enterGame(mode === 'create' ? createCode() : code)}
                >
                  {mode === 'create' ? 'Créer le groupe' : 'Rejoindre le groupe'}
                </Button>
                <Button variant="ghost" className="h-9 w-full text-muted-foreground" onClick={() => setMode('home')}>
                  Retour
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-white/10 pt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Un téléphone par joueur</span>
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
        </footer>
      </div>
    </main>
  );
}

