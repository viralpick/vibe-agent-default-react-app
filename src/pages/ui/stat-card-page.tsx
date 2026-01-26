import { useState } from "react";
import { StatCard } from "@/components/patterns/stat-card";
import { BarChart3, Users, ShoppingCart, TrendingUp, Wallet, Activity } from "lucide-react";
import { OptionButton } from "./ui-shared";

export function StatCardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [trendDirection, setTrendDirection] = useState<"up" | "down" | "neutral">("up");

  const getTrendValue = () => {
    switch (trendDirection) {
      case "up": return 12.5;
      case "down": return -8.3;
      default: return 0;
    }
  };

  const getTrendText = () => {
    switch (trendDirection) {
      case "up": return "+12.5%";
      case "down": return "-8.3%";
      default: return "0%";
    }
  };

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">StatCard Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Loading</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={isLoading} onClick={() => setIsLoading(true)} />
                <OptionButton label="No" selected={!isLoading} onClick={() => setIsLoading(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Trend</span>
              <div className="flex gap-8">
                <OptionButton label="Up" selected={trendDirection === "up"} onClick={() => setTrendDirection("up")} />
                <OptionButton label="Down" selected={trendDirection === "down"} onClick={() => setTrendDirection("down")} />
                <OptionButton label="Neutral" selected={trendDirection === "neutral"} onClick={() => setTrendDirection("neutral")} />
              </div>
            </div>
          </div>

          <div className="flex items-start justify-center p-32 bg-white rounded-small border border-gray-200">
            <div className="w-[300px]">
              <StatCard
                title="Total Revenue"
                value="₩125,430,000"
                trend={getTrendValue()}
                trendValue={getTrendText()}
                isLoading={isLoading}
                icon={BarChart3}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">StatCard - Grid Example</h2>
        <div className="grid grid-cols-4 gap-16">
          <StatCard
            title="Total Revenue"
            value="₩125,430,000"
            trend={12.5}
            trendValue="+12.5%"
            isLoading={false}
            icon={Wallet}
          />
          <StatCard
            title="Active Users"
            value="5,678명"
            trend={8.2}
            trendValue="+8.2%"
            isLoading={false}
            icon={Users}
          />
          <StatCard
            title="Orders"
            value="1,234건"
            trend={-3.1}
            trendValue="-3.1%"
            isLoading={false}
            icon={ShoppingCart}
          />
          <StatCard
            title="Growth Rate"
            value="23.5%"
            trend={5.7}
            trendValue="+5.7%"
            isLoading={false}
            icon={TrendingUp}
          />
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">StatCard - Loading State</h2>
        <div className="grid grid-cols-4 gap-16">
          <StatCard
            title="Loading..."
            value=""
            trend={0}
            trendValue=""
            isLoading={true}
            icon={Activity}
          />
          <StatCard
            title="Loading..."
            value=""
            trend={0}
            trendValue=""
            isLoading={true}
            icon={Activity}
          />
          <StatCard
            title="Loading..."
            value=""
            trend={0}
            trendValue=""
            isLoading={true}
            icon={Activity}
          />
          <StatCard
            title="Loading..."
            value=""
            trend={0}
            trendValue=""
            isLoading={true}
            icon={Activity}
          />
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">StatCard - Trend Variations</h2>
        <div className="grid grid-cols-3 gap-16">
          <StatCard
            title="Positive Trend"
            value="₩50,000,000"
            trend={15.3}
            trendValue="+15.3%"
            isLoading={false}
            icon={TrendingUp}
          />
          <StatCard
            title="Negative Trend"
            value="₩30,000,000"
            trend={-7.8}
            trendValue="-7.8%"
            isLoading={false}
            icon={TrendingUp}
          />
          <StatCard
            title="No Change"
            value="₩40,000,000"
            trend={0}
            trendValue="0%"
            isLoading={false}
            icon={TrendingUp}
          />
        </div>
      </section>
    </div>
  );
}
