import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface MedicalHistoryStepProps {
  data: {
    diagnosisStatus: boolean;
    diagnosisDate: string;
    knownTriggers: string[];
    currentSymptoms: string[];
    respiratoryIssues: string[];
    allergies: string[];
    smokingStatus: string;
    familyHistory: boolean;
    chronicConditions: string[];
  };
  onChange: (data: any) => void;
}

const triggers = ['dust_mites', 'pollen', 'cold_air', 'exercise', 'occupational', 'seasonal'];
const symptoms = ['breathlessness', 'cough', 'wheezing', 'chest_tightness'];
const respiratory = ['allergic_rhinitis', 'chronic_cough', 'sinusitis'];
const allergies = ['pets', 'dust', 'pollen', 'mold', 'food', 'nsaids'];
const conditions = ['hypertension', 'diabetes', 'heart_disease', 'other'];

export const MedicalHistoryStep = ({ data, onChange }: MedicalHistoryStepProps) => {
  const toggleArrayItem = (array: string[], item: string) => {
    return array.includes(item) 
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label>Asthma Diagnosis *</Label>
        <RadioGroup 
          value={data.diagnosisStatus ? 'yes' : 'no'} 
          onValueChange={(value) => onChange({ ...data, diagnosisStatus: value === 'yes' })}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="diagnosis-yes" />
            <Label htmlFor="diagnosis-yes" className="font-normal cursor-pointer">Yes, I have been diagnosed with asthma</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="diagnosis-no" />
            <Label htmlFor="diagnosis-no" className="font-normal cursor-pointer">No diagnosis</Label>
          </div>
        </RadioGroup>
      </div>

      {data.diagnosisStatus && (
        <div className="space-y-2">
          <Label htmlFor="diagnosisDate">Date of Diagnosis</Label>
          <Input
            id="diagnosisDate"
            type="date"
            value={data.diagnosisDate}
            onChange={(e) => onChange({ ...data, diagnosisDate: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-3">
        <Label>Known Triggers</Label>
        <div className="grid grid-cols-2 gap-3">
          {triggers.map((trigger) => (
            <div key={trigger} className="flex items-center space-x-2">
              <Checkbox
                id={`trigger-${trigger}`}
                checked={data.knownTriggers.includes(trigger)}
                onCheckedChange={() => 
                  onChange({ ...data, knownTriggers: toggleArrayItem(data.knownTriggers, trigger) })
                }
              />
              <Label htmlFor={`trigger-${trigger}`} className="font-normal cursor-pointer">
                {trigger.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Current Symptoms</Label>
        <div className="grid grid-cols-2 gap-3">
          {symptoms.map((symptom) => (
            <div key={symptom} className="flex items-center space-x-2">
              <Checkbox
                id={`symptom-${symptom}`}
                checked={data.currentSymptoms.includes(symptom)}
                onCheckedChange={() => 
                  onChange({ ...data, currentSymptoms: toggleArrayItem(data.currentSymptoms, symptom) })
                }
              />
              <Label htmlFor={`symptom-${symptom}`} className="font-normal cursor-pointer">
                {symptom.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Other Respiratory Issues</Label>
        <div className="grid grid-cols-2 gap-3">
          {respiratory.map((issue) => (
            <div key={issue} className="flex items-center space-x-2">
              <Checkbox
                id={`respiratory-${issue}`}
                checked={data.respiratoryIssues.includes(issue)}
                onCheckedChange={() => 
                  onChange({ ...data, respiratoryIssues: toggleArrayItem(data.respiratoryIssues, issue) })
                }
              />
              <Label htmlFor={`respiratory-${issue}`} className="font-normal cursor-pointer">
                {issue.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Allergies</Label>
        <div className="grid grid-cols-2 gap-3">
          {allergies.map((allergy) => (
            <div key={allergy} className="flex items-center space-x-2">
              <Checkbox
                id={`allergy-${allergy}`}
                checked={data.allergies.includes(allergy)}
                onCheckedChange={() => 
                  onChange({ ...data, allergies: toggleArrayItem(data.allergies, allergy) })
                }
              />
              <Label htmlFor={`allergy-${allergy}`} className="font-normal cursor-pointer">
                {allergy.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="smokingStatus">Smoking Status *</Label>
        <Select value={data.smokingStatus} onValueChange={(value) => onChange({ ...data, smokingStatus: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select smoking status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never">Never smoked</SelectItem>
            <SelectItem value="former">Former smoker</SelectItem>
            <SelectItem value="current">Current smoker</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="familyHistory"
          checked={data.familyHistory}
          onCheckedChange={(checked) => onChange({ ...data, familyHistory: checked === true })}
        />
        <Label htmlFor="familyHistory" className="font-normal cursor-pointer">
          Family history of asthma or allergies
        </Label>
      </div>

      <div className="space-y-3">
        <Label>Other Chronic Conditions</Label>
        <div className="grid grid-cols-2 gap-3">
          {conditions.map((condition) => (
            <div key={condition} className="flex items-center space-x-2">
              <Checkbox
                id={`condition-${condition}`}
                checked={data.chronicConditions.includes(condition)}
                onCheckedChange={() => 
                  onChange({ ...data, chronicConditions: toggleArrayItem(data.chronicConditions, condition) })
                }
              />
              <Label htmlFor={`condition-${condition}`} className="font-normal cursor-pointer">
                {condition.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
