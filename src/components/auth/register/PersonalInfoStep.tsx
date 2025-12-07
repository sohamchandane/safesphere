import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PersonalInfoStepProps {
  data: {
    email: string;
    password: string;
    username: string;
    dob: string;
    gender: string;
    phoneNumber: string;
  };
  onChange: (data: any) => void;
}

export const PersonalInfoStep = ({ data, onChange }: PersonalInfoStepProps) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            value={data.username}
            onChange={(e) => onChange({ ...data, username: e.target.value })}
            placeholder="johndoe"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder="john@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={data.password}
          onChange={(e) => onChange({ ...data, password: e.target.value })}
          placeholder="••••••••"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth *</Label>
          <Input
            id="dob"
            type="date"
            value={data.dob}
            onChange={(e) => onChange({ ...data, dob: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender *</Label>
          <Select value={data.gender} onValueChange={(value) => onChange({ ...data, gender: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={data.phoneNumber}
          onChange={(e) => onChange({ ...data, phoneNumber: e.target.value })}
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>
  );
};
