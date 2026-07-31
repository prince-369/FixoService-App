/**
 * Wallet tab.
 *
 * The design puts Wallet in the bottom bar, but `/transactions` already exists as a pushed
 * route and is linked from the drawer, notifications and booking screens. Re-exporting keeps
 * one implementation behind both paths instead of duplicating the screen.
 */
export { default } from '../transactions';
