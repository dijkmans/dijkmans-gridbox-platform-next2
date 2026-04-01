"use client";

import { ProvisioningStepContent } from "../types";

type AdminProvisioningSectionProps = {
  selectedProvisioningStep: number;
  provisioningSteps: string[];
  provisioningStepContent: ProvisioningStepContent[];
  onStepChange: (step: number) => void;
};

export default function AdminProvisioningSection({
  selectedProvisioningStep,
  provisioningSteps,
  provisioningStepContent,
  onStepChange
}: AdminProvisioningSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Installatiecockpit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Dit is de nieuwe wizardstructuur voor toekomstige provisioning. In deze slice
            tonen we bewust alleen de shell. Geen fake backendstatus, geen verzonnen succes.
          </p>
        </div>
        <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Alleen voor platformbeheer
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        Let op: deze cockpit is nu nog een structurele eerste stap. De echte provisioningflow
        moet later backend-gestuurd worden aangesloten.
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {provisioningSteps.map((step, index) => {
            const active = selectedProvisioningStep === index;

            return (
              <button
                key={step}
                type="button"
                onClick={() => onStepChange(index)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Stap {index + 1}
                </div>
                <div className="mt-2 text-sm font-bold">{step}</div>
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-xl font-bold text-slate-900">
            {provisioningStepContent[selectedProvisioningStep].title}
          </h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            {provisioningStepContent[selectedProvisioningStep].text}
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">
              Waarom deze stap nu al tonen
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Omdat de structuur van de admin eerst goed moet zitten. Anders bouw je
              later provisioning bovenop een rommelscherm en zit je opnieuw scheef.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
