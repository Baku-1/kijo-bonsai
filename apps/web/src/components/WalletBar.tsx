// ---------------------------------------------------------------------------
// WalletBar — Connect/disconnect UI, portalled into #wallet-bar-anchor.
//
// WHY A PORTAL? ThreeCanvas renders #hud-top (and #wallet-bar-anchor inside
// it), but WalletBar is a sibling of ThreeCanvas in App. The portal lets
// WalletBar appear inside #hud-top without ThreeCanvas knowing about wallet
// state, keeping the separation clean.
//
// WHY useEffect FOR ANCHOR LOOKUP? React commits all sibling components'
// DOM in one atomic pass. During a component's render body, sibling DOM
// hasn't been committed yet — document.getElementById would return null.
// useEffect runs after the commit phase, so the anchor is guaranteed to exist.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useWallet } from '../wallet/useWallet.js';
import { saigon, ronin } from '../wallet/config.js';

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function WalletBarContent() {
  const { address, isConnected, chain, isPending, connectWallet, disconnect } =
    useWallet();

  // Chain mismatch: connected but not on Ronin mainnet or Saigon testnet.
  const isWrongChain =
    isConnected &&
    chain?.id !== saigon.id &&
    chain?.id !== ronin.id;

  if (!isConnected) {
    return (
      <div id="wallet-bar">
        <button
          className="wallet-btn"
          onClick={connectWallet}
          disabled={isPending}
        >
          {isPending ? 'Connecting…' : '🔗 Connect Wallet'}
        </button>
      </div>
    );
  }

  if (isWrongChain) {
    return (
      <div id="wallet-bar">
        <span style={{ color: '#B0542A' }}>Wrong network</span>
        <button className="wallet-btn" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div id="wallet-bar">
      <span className="wallet-chain">{chain?.name ?? 'Unknown chain'}</span>
      <span className="wallet-addr">{truncate(address!)}</span>
      <button className="wallet-btn" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}

export function WalletBar() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // ThreeCanvas has committed its DOM by the time this runs.
    setAnchor(document.getElementById('wallet-bar-anchor'));
  }, []);

  if (!anchor) return null;
  return ReactDOM.createPortal(<WalletBarContent />, anchor);
}
