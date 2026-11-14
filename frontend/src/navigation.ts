import { LayoutDashboard, Bot, MessageCircle, Ticket, Wallet, UserRoundCheck, Trophy, Landmark, Gift, Users, History, GraduationCap, ClipboardList, FileText, Megaphone, Share2, BookOpen, ShoppingBag, UserRound, LifeBuoy, Tv, Dices, Smartphone, Briefcase, Clapperboard, RotateCcw, Plane, Goal, Building2, Youtube, type LucideIcon } from 'lucide-react'
import type { TranslationKey } from './i18n'
import { normalizeCountry } from './domain/countries'

type NavigationItem = { path: string; key?: TranslationKey; label?: string; icon: LucideIcon; color: string }
type NavigationGroup = { group: TranslationKey; items: NavigationItem[] }
export const navigation: NavigationGroup[] = [
  { group: 'main' as TranslationKey, items: [
    { path: '', key: 'dashboard' as TranslationKey, icon: LayoutDashboard, color: 'indigo' },
    { path: 'robots', key: 'roboticPlansNav', icon: Bot, color: 'teal' },
    { path: 'trading', key: 'trading' as TranslationKey, icon: Bot, color: 'violet' },
    { path: 'chat', key: 'chat' as TranslationKey, icon: MessageCircle, color: 'teal' },
  ] },
  { group: 'accounts' as TranslationKey, items: [
    { path: 'voucher', key: 'voucher' as TranslationKey, icon: Ticket, color: 'pink' },
    { path: 'deposit', key: 'deposit' as TranslationKey, icon: Wallet, color: 'blue' },
    { path: 'pay-for-client', key: 'payForClient', icon: UserRoundCheck, color: 'red' },
    { path: 'ranks', key: 'ranks' as TranslationKey, icon: Trophy, color: 'green' },
    { path: 'withdraw', key: 'withdraw' as TranslationKey, icon: Landmark, color: 'violet' },
    { path: 'claim-bonus', key: 'claimBonus', icon: Gift, color: 'teal' },
    { path: 'referrals', key: 'team', icon: Users, color: 'amber' },
    { path: 'transactions', key: 'transactionHistory', icon: History, color: 'amber' },
    { path: 'reversals', key: 'reversals', icon: RotateCcw, color: 'red' },
  ] },
  { group: 'explore' as TranslationKey, items: [
    { path: 'courses', key: 'courses' as TranslationKey, icon: GraduationCap, color: 'blue' },
    { path: 'surveys', key: 'surveys' as TranslationKey, icon: ClipboardList, color: 'pink' },
    { path: 'articles', key: 'articleTasks', icon: FileText, color: 'teal' },
    { path: 'ads', key: 'adTasks', icon: Megaphone, color: 'amber' },
    { path: 'social', key: 'socialMediaTasks', icon: Share2, color: 'violet' },
    { path: 'ebooks', key: 'businessEbooks', icon: BookOpen, color: 'indigo' },
    { path: 'shop', key: 'shop', icon: ShoppingBag, color: 'green' },
    { path: 'language-teaching', key: 'teachKinyarwanda', icon: MessageCircle, color: 'red' },
    { path: 'foreigners', key: 'chatWithForeigners', icon: Users, color: 'green' },
    { path: 'digital-marketing', key: 'digitalMarketing', icon: Briefcase, color: 'blue' },
    { path: 'forex-lessons', key: 'forexLessons', icon: GraduationCap, color: 'violet' },
    { path: 'videos', key: 'videosReels', icon: Tv, color: 'red' },
    { path: 'movies', key: 'movies', icon: Clapperboard, color: 'pink' },
    { path: 'games', key: 'gamesTrivia', icon: Dices, color: 'amber' },
    { path: 'airtime', key: 'buyAirtime', icon: Smartphone, color: 'green' },
  ] },
  { group: 'settings' as TranslationKey, items: [
    { path: 'profile', key: 'profile' as TranslationKey, icon: UserRound, color: 'blue' },
    { path: 'support', key: 'support' as TranslationKey, icon: LifeBuoy, color: 'pink' },
  ] },
]
export const rwandaNavigation: NavigationGroup[] = [
  { group: 'main', items: [
    { path: '', key: 'dashboard', icon: LayoutDashboard, color: 'indigo' },
    { path: 'trading', key: 'trading', icon: Bot, color: 'violet' },
  ] },
  { group: 'accounts', items: [
    { path: 'voucher', key: 'voucher', icon: Ticket, color: 'pink' },
    { path: 'deposit', key: 'deposit', icon: Wallet, color: 'blue' },
    { path: 'pay-for-client', key: 'payForClient', icon: UserRoundCheck, color: 'red' },
    { path: 'ranks', key: 'ranks', icon: Trophy, color: 'green' },
    { path: 'withdraw', key: 'withdraw', icon: Landmark, color: 'violet' },
    { path: 'claim-bonus', key: 'claimBonus', icon: Gift, color: 'teal' },
    { path: 'whatsapp', label: 'Whatsapp', icon: MessageCircle, color: 'indigo' },
    { path: 'referrals', key: 'team', icon: Users, color: 'amber' },
    { path: 'account-tools', key: 'accounts', icon: Building2, color: 'pink' },
  ] },
  { group: 'products', items: [
    { path: 'language-teaching', key: 'teachKinyarwanda', icon: MessageCircle, color: 'red' },
    { path: 'foreigners', key: 'chatWithForeigners', icon: Users, color: 'green' },
    { path: 'digital-marketing', key: 'digitalMarketing', icon: GraduationCap, color: 'violet' },
    { path: 'forex-lessons', key: 'forexLessons', icon: Landmark, color: 'teal' },
    { path: 'aviator', label: 'Aviator', icon: Plane, color: 'indigo' },
    { path: 'spin', label: 'Spin & Win', icon: Dices, color: 'amber' },
    { path: 'fixed-bets', label: 'Fixed Bets', icon: Ticket, color: 'pink' },
    { path: 'soccer', label: 'Soccer', icon: Goal, color: 'green' },
    { path: 'shop', label: 'FREE SHOP', icon: ShoppingBag, color: 'red' },
    { path: 'whatsapp-earn', label: 'Whatsapp Earn', icon: MessageCircle, color: 'teal' },
    { path: 'movies', key: 'movies', icon: Clapperboard, color: 'violet' },
    { path: 'meta-ads', label: 'Meta ADS', icon: Megaphone, color: 'green' },
    { path: 'reels', label: 'Reels', icon: Tv, color: 'blue' },
    { path: 'articles', label: 'Articles', icon: FileText, color: 'amber' },
    { path: 'ads', label: 'Ads Earnings', icon: Megaphone, color: 'pink' },
    { path: 'tiktok', label: 'Tiktok Earn', icon: Smartphone, color: 'violet' },
    { path: 'youtube', label: 'Youtube Earn', icon: Youtube, color: 'red' },
    { path: 'surveys', label: 'Survey Challenge', icon: ClipboardList, color: 'green' },
    { path: 'ebooks', key: 'businessEbooks', icon: BookOpen, color: 'teal' },
    { path: 'airtime', key: 'buyAirtime', icon: Smartphone, color: 'blue' },
  ] },
  { group: 'settings', items: [
    { path: 'profile', key: 'profile', icon: UserRound, color: 'amber' },
    { path: 'support', label: 'Contact US', icon: LifeBuoy, color: 'pink' },
  ] },
]
export function navigationForCountry(country: unknown) { return normalizeCountry(country) === 'Rwanda' ? rwandaNavigation : navigation }
export type NavigationChild = { path: string; label: string; children?: NavigationChild[] }
export const navigationChildren: Record<string, NavigationChild[]> = {
  'account-tools': [{ path: 'reversals', label: 'Reversals' }],
  voucher: [{ path: 'voucher', label: 'Buy Voucher' }, { path: 'voucher/history', label: 'History' }],
  withdraw: [
    { path: 'withdraw', label: 'Withdraw' },
    { path: 'withdraw/youtube', label: 'Withdraw Youtube' },
    { path: 'withdraw/trivia', label: 'Withdraw Trivia' },
    { path: 'withdraw/games', label: 'Withdraw Games' },
    { path: 'withdraw/tiktok', label: 'Withdraw Tiktok' },
    { path: 'withdraw/socials', label: 'Withdraw Socials' },
    { path: 'withdraw/chat', label: 'Withdraw from Chat' },
    { path: 'withdraw/history', label: 'Withdraw History' },
  ],
  referrals: [1, 2, 3].map(level => ({
    path: `referrals/level-${level}`, label: `Level ${level}`,
    children: [
      { path: `referrals/level-${level}/active`, label: 'Active' },
      { path: `referrals/level-${level}/inactive`, label: 'Inactive' },
    ],
  })),
}
function flattenChildren(items: NavigationChild[]): NavigationChild[] { return items.flatMap(item => [item, ...flattenChildren(item.children || [])]) }
export const allNavigation: NavigationItem[] = [...navigation.flatMap(group => group.items), ...rwandaNavigation.flatMap(group => group.items), ...flattenChildren(Object.values(navigationChildren).flat()).map(item => ({ ...item, icon: History, color: 'teal' }))]
