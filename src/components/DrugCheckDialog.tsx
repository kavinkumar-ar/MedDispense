import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, ShieldCheck, Loader2, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface DrugCheckResult {
  severity: "safe" | "warning" | "danger";
  summary: string;
  interactions: {
    type: "drug_interaction" | "allergy" | "dosage";
    severity: "low" | "moderate" | "high" | "critical";
    description: string;
    recommendation: string;
  }[];
}

interface DrugCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  patientId: string;
  patientAllergies: string | null;
  currentMedications: string[];
  onProceed: () => void;
  onCancel: () => void;
}

const severityConfig = {
  safe: { icon: ShieldCheck, color: "text-success", bg: "bg-success/10", label: "Safe" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Warning" },
  danger: { icon: ShieldX, color: "text-destructive", bg: "bg-destructive/10", label: "Danger" },
};

const itemSeverityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  moderate: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

export const DrugCheckDialog = ({
  open,
  onOpenChange,
  medication,
  dosage,
  frequency,
  duration,
  patientAllergies,
  currentMedications,
  onProceed,
  onCancel,
}: DrugCheckDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrugCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("drug-check", {
        body: {
          medication,
          dosage,
          frequency,
          duration,
          patient_allergies: patientAllergies,
          current_medications: currentMedications,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult(data as DrugCheckResult);

      if (data.severity === "safe") {
        // Auto-proceed after brief display
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run safety check");
    } finally {
      setLoading(false);
    }
  };

  // Auto-run check when dialog opens
  useEffect(() => {
    if (open && !result && !loading && !error) {
      runCheck();
    }
  }, [open]);

  // Run check when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setResult(null);
      setError(null);
      setShowOverride(false);
      setOverrideReason("");
    }
    onOpenChange(isOpen);
  };

  const handleProceed = () => {
    setResult(null);
    setShowOverride(false);
    setOverrideReason("");
    onProceed();
  };

  const handleOverride = () => {
    if (!overrideReason.trim()) return;
    handleProceed();
  };

  const config = result ? severityConfig[result.severity] : null;
  const Icon = config?.icon || ShieldCheck;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            AI Drug Safety Check
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Checking info */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p><strong>Medication:</strong> {medication} ({dosage})</p>
            <p><strong>Frequency:</strong> {frequency}{duration ? ` · ${duration}` : ""}</p>
            {patientAllergies && <p><strong>Patient Allergies:</strong> {patientAllergies}</p>}
            {currentMedications.length > 0 && (
              <p><strong>Current Medications:</strong> {currentMedications.join(", ")}</p>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Analyzing prescription safety...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Safety check failed</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <>
              <div className={`rounded-lg ${config?.bg} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${config?.color}`} />
                  <span className={`font-semibold ${config?.color}`}>{config?.label}</span>
                </div>
                <p className="text-sm">{result.summary}</p>
              </div>

              {result.interactions.length > 0 && (
                <div className="space-y-2">
                  {result.interactions.map((item, i) => (
                    <div key={i} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={itemSeverityColors[item.severity]} variant="secondary">
                          {item.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.type.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-muted-foreground mt-1">💡 {item.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

            </>
          )}

          {/* Override section for warnings/dangers or service errors */}
          {((result && result.severity !== "safe") || error) && showOverride && (
            <div className="rounded-lg border-2 border-warning p-3 space-y-2 mt-4">
              <p className="text-sm font-medium">Override Reason (required):</p>
              <Textarea
                placeholder="Explain why you're proceeding despite the warning..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {error && !showOverride && (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button variant="outline" onClick={runCheck}>Retry Check</Button>
              <Button variant="destructive" onClick={() => setShowOverride(true)}>
                Proceed Anyway
              </Button>
            </>
          )}

          {error && showOverride && (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!overrideReason.trim()}
                onClick={handleOverride}
              >
                Confirm Override & Proceed
              </Button>
            </>
          )}

          {result?.severity === "safe" && (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={handleProceed}>✓ Proceed</Button>
            </>
          )}

          {result && result.severity !== "safe" && !showOverride && (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button variant="destructive" onClick={() => setShowOverride(true)}>
                Override & Proceed
              </Button>
            </>
          )}

          {result && result.severity !== "safe" && showOverride && (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!overrideReason.trim()}
                onClick={handleOverride}
              >
                Confirm Override
              </Button>
            </>
          )}

          {!result && !error && !loading && (
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
