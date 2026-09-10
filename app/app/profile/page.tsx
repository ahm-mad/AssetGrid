import { getMyProfile } from "@/lib/profile/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getMyProfile();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-muted-foreground text-sm">Your account and contact details.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
