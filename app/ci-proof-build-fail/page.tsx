/** Intentional build failure for Quality Gates proof (throws during prerender). */
export default function CiProofBuildFailPage() {
  throw new Error("intentional CI proof build failure");
}
