"use client";

import { useState } from "react";
import { BottomCTA } from "@/components/common/BottomCTA";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";

type RuntimeIncident = {
  timestamp: string;
  route: string;
  category: string;
  stage?: string;
  failure_type?: string;
  provider?: string;
  signature_hash: string;
  message: string;
  user_id: string | null;
  remediation_hint: string;
  invalid_fields?: string[];
};

type RuntimeLearnedFailure = {
  signature_hash: string;
  route: string;
  stage?: string;
  failure_type?: string;
  provider?: string;
  occurrence_count: number;
  promotion_candidate: boolean;
  remediation_hint: string;
  invalid_fields?: string[];
};

type RuntimeFailurePayload = {
  incidents: RuntimeIncident[] | null;
  learned_failures: Record<string, RuntimeLearnedFailure> | null;
  promotion_candidates:
    | Array<{
        signature_hash: string;
        category: string;
        route: string;
        failure_type?: string;
        provider?: string;
        occurrence_count: number;
        invalid_fields: string[];
        linked_doc: string;
        linked_rule: string;
        remediation_hint: string;
        suggested_rule: string;
      }>
    | null;
};

export default function RuntimeFailuresDevPage() {
  const [status, setStatus] = useState(
    "아직 runtime failure 리포트를 불러오지 않았습니다."
  );
  const [payload, setPayload] = useState<RuntimeFailurePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadRuntimeFailures() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/dev/runtime-failures");
      const data = (await response.json().catch(() => null)) as RuntimeFailurePayload | null;

      if (!response.ok || !data) {
        setStatus("runtime failure 리포트를 불러오지 못했습니다.");
        return;
      }

      setPayload(data);
      const incidentCount = data.incidents?.length ?? 0;
      const learnedCount = Object.keys(data.learned_failures ?? {}).length;
      const candidateCount = data.promotion_candidates?.length ?? 0;
      setStatus(
        `runtime incidents ${incidentCount}개, learned failures ${learnedCount}개, promotion candidates ${candidateCount}개를 읽었습니다.`
      );
    } finally {
      setIsLoading(false);
    }
  }

  const learnedFailures = Object.values(payload?.learned_failures ?? {});
  const promotionCandidates = payload?.promotion_candidates ?? [];

  return (
    <main className="app-shell space-y-8">
      <div className="space-y-4 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">
          Runtime Failures Dev
        </p>
        <h1 className="text-4xl font-bold tracking-[-0.04em]">
          런타임 장애와 승격 후보를 확인합니다
        </h1>
        <p className="max-w-md text-base leading-7 text-zinc-300">
          storage 장애와 provider 응답 drift가 fallback으로 끝나지 않고, incident와
          learned failure로 누적되는지 보는 로컬 진단 페이지입니다.
        </p>
      </div>

      <FeedbackCard
        body={status}
        label="Runtime Failure Report"
        accent={Boolean(payload)}
      />

      {payload?.incidents?.slice(-3).reverse().map((incident) => (
        <FeedbackCard
          key={`${incident.signature_hash}-${incident.timestamp}`}
          label={`${incident.route} / ${incident.stage ?? incident.failure_type ?? incident.category}`}
          body={[
            incident.provider ? `provider=${incident.provider}` : null,
            incident.message,
            incident.invalid_fields?.length
              ? `invalid_fields=${incident.invalid_fields.join(", ")}`
              : null,
            incident.remediation_hint,
            `signature=${incident.signature_hash}`,
            `timestamp=${incident.timestamp}`
          ]
            .filter((item): item is string => Boolean(item))
            .join("\n")}
        />
      ))}

      {learnedFailures.map((failure) => (
        <FeedbackCard
          key={failure.signature_hash}
          label={`${failure.route} learned failure`}
          accent={failure.promotion_candidate}
          body={[
            failure.provider ? `provider=${failure.provider}` : null,
            `stage=${failure.stage ?? failure.failure_type ?? "unknown"}`,
            `occurrence_count=${failure.occurrence_count}`,
            `promotion_candidate=${String(failure.promotion_candidate)}`,
            failure.invalid_fields?.length
              ? `invalid_fields=${failure.invalid_fields.join(", ")}`
              : null,
            failure.remediation_hint
          ]
            .filter((item): item is string => Boolean(item))
            .join("\n")}
        />
      ))}

      {promotionCandidates.map((candidate) => (
        <FeedbackCard
          key={`promotion-${candidate.signature_hash}`}
          label={`${candidate.route} promotion candidate`}
          accent
          body={[
            candidate.provider ? `provider=${candidate.provider}` : null,
            candidate.failure_type ? `failure_type=${candidate.failure_type}` : null,
            `occurrence_count=${candidate.occurrence_count}`,
            candidate.invalid_fields.length
              ? `invalid_fields=${candidate.invalid_fields.join(", ")}`
              : null,
            `linked_rule=${candidate.linked_rule}`,
            candidate.suggested_rule
          ]
            .filter((item): item is string => Boolean(item))
            .join("\n")}
        />
      ))}

      <BottomCTA
        disabled={isLoading}
        label={isLoading ? "리포트 읽는 중..." : "runtime failure 리포트 불러오기"}
        onClick={loadRuntimeFailures}
      />
    </main>
  );
}
