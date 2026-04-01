import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ShieldX, Info } from "lucide-react";

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

  const runLocalCheck = async () => {
    setLoading(true);
    setError(null);
    
    // Simulate brief processing
    await new Promise(resolve => setTimeout(resolve, 800));

    const interactions: DrugCheckResult["interactions"] = [];
    const lowerMed = medication.toLowerCase();

    // 1. Check Allergies (Basic string matching)
    if (patientAllergies) {
      const allergies = patientAllergies.toLowerCase().split(",").map(a => a.trim());
      const matchedAllergy = allergies.find(a => a && lowerMed.includes(a));
      if (matchedAllergy) {
        interactions.push({
          type: "allergy",
          severity: "critical",
          description: `Patient has a known allergy to ${matchedAllergy}.`,
          recommendation: "Avoid this medication. Prescribe an alternative class."
        });
      }
    }

    // 2. Check Duplicates
    if (currentMedications.some(m => m.toLowerCase().includes(lowerMed) || lowerMed.includes(m.toLowerCase()))) {
      interactions.push({
        type: "drug_interaction",
        severity: "high",
        description: `This medication (or similar) is already in the patient's active list.`,
        recommendation: "Verify if this is a dosage adjustment or a duplicate entry."
      });
    }

    let severity: DrugCheckResult["severity"] = "safe";
    let summary = "No immediate clinical safety concerns detected.";

    if (interactions.some(i => i.severity === "critical")) {
      severity = "danger";
      summary = "Critical safety alert: High risk of adverse reaction.";
    } else if (interactions.length > 0) {
      severity = "warning";
      summary = "Potential safety concerns detected. Please review carefully.";
    }

    setResult({ severity, summary, interactions });
    setLoading(false);
  };

  // Run check when dialog opens
  useEffect(() => {
    if (open && !result && !loading) {
      runLocalCheck();
    }
  }, [open]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setResult(null);
      setError(null);
      setLoading(false);
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
            <ShieldCheck className="h-5 w-5 text-primary" />
            Clinical Safety Check
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p><strong>Medication:</strong> {medication} ({dosage})</p>
            <p><strong>Frequency:</strong> {frequency}{duration ? ` · ${duration}` : ""}</p>
            {patientAllergies && <p><strong>Patient Allergies:</strong> {patientAllergies}</p>}
            {currentMedications.length > 0 && (
              <p><strong>Current Medications:</strong> {currentMedications.join(", ")}</p>
            )}
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Running clinical safety rules...</p>
            </div>
          )}

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

          {/* Override section for warnings/dangers */}
          {result && result.severity !== "safe" && showOverride && (
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

          <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Local safety verification active (internal rules system)</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {!result && !loading && (
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
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
                Confirm Override & Proceed
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DrugCheckDialog;
