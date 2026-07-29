import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Kijonsai } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Kijonsai', () => {
  let contract: Kijonsai;
  let admin: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const TOKEN_1 = 1n;
  const URI_1   = 'https://api.kijo.xyz/nft/metadata/1';

  beforeEach(async () => {
    [admin, minter, buyer, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('Kijonsai');
    contract = (await factory.deploy(admin.address, minter.address)) as Kijonsai;
    await contract.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('sets name = "Kijonsai" and symbol = "KIJO"', async () => {
      expect(await contract.name()).to.eq('Kijonsai');
      expect(await contract.symbol()).to.eq('KIJO');
    });

    it('grants DEFAULT_ADMIN_ROLE to admin', async () => {
      const ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it('grants MINTER_ROLE to minter', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();
      expect(await contract.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it('does not grant MINTER_ROLE to admin by default', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();
      expect(await contract.hasRole(MINTER_ROLE, admin.address)).to.be.false;
    });
  });

  // ── mintKijonsai ───────────────────────────────────────────────────────────

  describe('mintKijonsai', () => {
    it('mints token to buyer with correct URI and ownership', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      expect(await contract.ownerOf(TOKEN_1)).to.eq(buyer.address);
      expect(await contract.tokenURI(TOKEN_1)).to.eq(URI_1);
    });

    it('emits Transfer event', async () => {
      await expect(contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1))
        .to.emit(contract, 'Transfer')
        .withArgs(ethers.ZeroAddress, buyer.address, TOKEN_1);
    });

    it('emits MetadataUpdate event (ERC-4906, via OZ v5 _setTokenURI)', async () => {
      await expect(contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1))
        .to.emit(contract, 'MetadataUpdate')
        .withArgs(TOKEN_1);
    });

    it('reverts with AccessControlUnauthorizedAccount if caller lacks MINTER_ROLE', async () => {
      await expect(
        contract.connect(buyer).mintKijonsai(buyer.address, TOKEN_1, URI_1),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('reverts with ERC721InvalidSender if token already exists', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      await expect(
        contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1),
      ).to.be.revertedWithCustomError(contract, 'ERC721InvalidSender');
    });

    it('allows minting multiple tokens with server-assigned IDs', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, 1n, 'https://api.kijo.xyz/nft/metadata/1');
      await contract.connect(minter).mintKijonsai(buyer.address, 2n, 'https://api.kijo.xyz/nft/metadata/2');
      expect(await contract.ownerOf(1n)).to.eq(buyer.address);
      expect(await contract.ownerOf(2n)).to.eq(buyer.address);
    });
  });

  // ── updateMetadata ─────────────────────────────────────────────────────────

  describe('updateMetadata', () => {
    beforeEach(async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
    });

    it('updates tokenURI', async () => {
      const newURI = 'https://api.kijo.xyz/nft/metadata/1?v=2';
      await contract.connect(minter).updateMetadata(TOKEN_1, newURI);
      expect(await contract.tokenURI(TOKEN_1)).to.eq(newURI);
    });

    it('emits MetadataUpdate (ERC-4906)', async () => {
      const newURI = 'https://api.kijo.xyz/nft/metadata/1?v=2';
      await expect(contract.connect(minter).updateMetadata(TOKEN_1, newURI))
        .to.emit(contract, 'MetadataUpdate')
        .withArgs(TOKEN_1);
    });

    it('reverts with AccessControlUnauthorizedAccount for non-minter', async () => {
      await expect(
        contract.connect(buyer).updateMetadata(TOKEN_1, 'https://example.com/new'),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('reverts with ERC721NonexistentToken for missing token', async () => {
      await expect(
        contract.connect(minter).updateMetadata(999n, 'https://api.kijo.xyz/nft/metadata/999'),
      ).to.be.revertedWithCustomError(contract, 'ERC721NonexistentToken');
    });
  });

  // ── emitBatchMetadataUpdate ────────────────────────────────────────────────

  describe('emitBatchMetadataUpdate', () => {
    it('emits BatchMetadataUpdate for a range when called by minter', async () => {
      await expect(contract.connect(minter).emitBatchMetadataUpdate(1n, type256Max()))
        .to.emit(contract, 'BatchMetadataUpdate')
        .withArgs(1n, type256Max());
    });

    it('reverts if caller lacks MINTER_ROLE', async () => {
      await expect(
        contract.connect(buyer).emitBatchMetadataUpdate(1n, 100n),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── Role rotation ──────────────────────────────────────────────────────────
  // Three scenarios:
  //   (a) Deploy with minter A → A can mint.
  //   (b) Grant MINTER_ROLE to B, revoke A → B succeeds, A reverts.
  //   (c) DEFAULT_ADMIN_ROLE holder can grant/revoke but cannot mint directly.

  describe('role rotation', () => {
    it('(a) minter A can mint immediately after deployment', async () => {
      await contract.connect(minter).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      expect(await contract.ownerOf(TOKEN_1)).to.eq(buyer.address);
    });

    it('(b) after granting MINTER_ROLE to B and revoking A: B succeeds, A reverts', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();

      // Grant MINTER_ROLE to `other` (minter B), revoke from `minter` (A).
      await contract.connect(admin).grantRole(MINTER_ROLE, other.address);
      await contract.connect(admin).revokeRole(MINTER_ROLE, minter.address);

      // B (other) can mint.
      await contract.connect(other).mintKijonsai(buyer.address, TOKEN_1, URI_1);
      expect(await contract.ownerOf(TOKEN_1)).to.eq(buyer.address);

      // A (minter) cannot mint — role was revoked.
      await expect(
        contract.connect(minter).mintKijonsai(buyer.address, 2n, URI_1),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('(c) DEFAULT_ADMIN_ROLE holder can grant/revoke MINTER_ROLE but cannot mint directly', async () => {
      const MINTER_ROLE = await contract.MINTER_ROLE();

      // Admin can grant MINTER_ROLE.
      await contract.connect(admin).grantRole(MINTER_ROLE, other.address);
      expect(await contract.hasRole(MINTER_ROLE, other.address)).to.be.true;

      // Admin can revoke MINTER_ROLE.
      await contract.connect(admin).revokeRole(MINTER_ROLE, other.address);
      expect(await contract.hasRole(MINTER_ROLE, other.address)).to.be.false;

      // Admin cannot mint directly — does not hold MINTER_ROLE by default.
      await expect(
        contract.connect(admin).mintKijonsai(buyer.address, TOKEN_1, URI_1),
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });
  });

  // ── supportsInterface ──────────────────────────────────────────────────────

  describe('supportsInterface', () => {
    const cases: [string, string][] = [
      ['0x80ac58cd', 'ERC-721'],
      ['0x5b5e139f', 'ERC-721Metadata'],
      ['0x49064906', 'ERC-4906'],
      ['0x7965db0b', 'IAccessControl'],
      ['0x01ffc9a7', 'ERC-165'],
    ];

    for (const [id, name] of cases) {
      it(`supports ${name} (${id})`, async () => {
        expect(await contract.supportsInterface(id as `0x${string}`)).to.be.true;
      });
    }

    it('returns false for unknown interface', async () => {
      expect(await contract.supportsInterface('0xdeadbeef')).to.be.false;
    });
  });
});

function type256Max(): bigint {
  return 2n ** 256n - 1n;
}
