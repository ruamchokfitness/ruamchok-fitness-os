import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Users, Wrench, Trophy, Users2, FileSignature, Settings } from 'lucide-react';

export default function Home() {
  const menuItems = [
    {
      title: 'RCF Sales Dashboard',
      description: 'Dashboard for sales analytics.',
      href: '/sales',
      icon: <BarChart className="w-8 h-8 text-primary" />,
    },
    {
      title: 'RCF HRM',
      description: 'Employee leave management system.',
      href: '/hrm',
      icon: <Users className="w-8 h-8 text-primary" />,
    },
    {
      title: 'RCF Maintenance Log',
      description: 'Track and manage equipment maintenance.',
      href: '/maintenance',
      icon: <Wrench className="w-8 h-8 text-primary" />,
    },
    {
      title: 'RCF PT Session & Commission Tracker',
      description: 'Track personal training sessions and commissions.',
      href: '/pt-tracker',
      icon: <Trophy className="w-8 h-8 text-primary" />,
    },
    {
      title: 'Member Sign-in Sheet',
      description: 'PT client sign-in, PAR-Q, and workout log.',
      href: '/member-signin',
      icon: <FileSignature className="w-8 h-8 text-primary" />,
    },
     {
      title: 'RCF Group Class Attendance Tracker',
      description: 'Track and analyze group class attendance.',
      href: '/group-class-tracker',
      icon: <Users2 className="w-8 h-8 text-primary" />,
    },
    {
      title: 'Settings',
      description: 'Manage users and system settings.',
      href: '/settings',
      icon: <Settings className="w-8 h-8 text-primary" />,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-gray-800 mb-2 font-headline">
          Ruamchok Fitness OS
        </h1>
        <p className="text-lg text-gray-600">Your central hub for managing fitness center operations.</p>
      </header>
      <main>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {menuItems.map((item) => (
            <Link key={item.title} href={item.href} passHref>
              <Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div>{item.icon}</div>
                  <div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <footer className="text-center mt-12 text-gray-500">
        <p>&copy; {new Date().getFullYear()} Ruamchok Fitness. All rights reserved.</p>
      </footer>
    </div>
  );
}
