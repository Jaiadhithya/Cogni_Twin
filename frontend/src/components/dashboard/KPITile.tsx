import { ReactNode } from 'react';

interface KPITileProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  colorClass: string;
}

export default function KPITile({ title, value, icon, colorClass }: KPITileProps) {
  return (
    <div className="flex flex-col justify-between p-5 bg-card text-card-foreground shadow-xl drop-shadow-lg rounded-3xl">
      <div className="flex items-center justify-between text-muted-foreground text-xs font-medium tracking-wider uppercase mb-3">
        <span>{title}</span>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${colorClass}`}>
          {icon}
        </div>
      </div>
      <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
    </div>
  );
}
