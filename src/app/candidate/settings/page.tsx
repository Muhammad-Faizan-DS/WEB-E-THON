"use client";
import { useMe } from "@/lib/client/me";
import { PageHeader } from "@/components/common/app-shell";
import { DisplaySettings, Shortcuts, TEXT_SIZES } from "@/components/exam/tools-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { me, setPreferences } = useMe();
  return (
    <>
      <PageHeader title="Workspace settings" description="How your exam screen looks. These follow you into every exam, and you can change them during an exam too." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader><CardTitle>Display</CardTitle></CardHeader>
          <CardContent><DisplaySettings prefs={me.preferences} onChange={setPreferences} /></CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
            <CardContent>
              <p className="q-text" style={{ ["--q-size" as string]: TEXT_SIZES[me.preferences.textSize] }}>
                Which statistic is least affected by an extreme outlier?
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Keyboard shortcuts</CardTitle></CardHeader>
            <CardContent><Shortcuts /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
