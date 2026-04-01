"use client";

export default function AdminLogsSection() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Provisioning logs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Dit scherm is voorlopig nog bewust een placeholder. Eerst de structuur recht,
          daarna pas de echte provisioning- en logkoppeling.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
          Nog niet aangesloten in deze pagina:
          <br />
          - echte provisioningstatussen
          <br />
          - device claim en heartbeat
          <br />
          - foutdetails per installatie
        </div>
      </div>
    </section>
  );
}
