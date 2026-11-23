import { createContext, useContext, useEffect } from 'react';

type ReportBusyFn = (busy: boolean) => void;

export const FormBusyContext = createContext<ReportBusyFn | null>(null);

/** Informa a un FormDialog o FormSheet contenedor que hay una mutación en vuelo. */
export function useReportBusy(isBusy: boolean): void {
  const reportBusy = useContext(FormBusyContext);

  useEffect(() => {
    if (!reportBusy) {
      return undefined;
    }
    reportBusy(isBusy);
    return () => {
      reportBusy(false);
    };
  }, [isBusy, reportBusy]);
}
