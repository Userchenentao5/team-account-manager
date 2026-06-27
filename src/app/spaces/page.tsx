import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SpacesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold leading-tight">空间</h1>
      <Card>
        <CardHeader>
          <CardTitle>空间</CardTitle>
        </CardHeader>
        <CardContent className="text-base text-muted-foreground">
          空间管理将在后续阶段实现。
        </CardContent>
      </Card>
    </div>
  );
}
