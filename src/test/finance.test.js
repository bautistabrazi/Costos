import { describe,expect,it } from 'vitest'
import { expensesForPeriod,splitInstallments,statementForPurchase } from '../utils/finance'
describe('cálculos financieros',()=>{
 it('asigna al próximo resumen una compra posterior al cierre',()=>expect(statementForPurchase('2026-07-21',20,5).statementPeriod).toBe('2026-08'))
 it('conserva los centavos exactos en cuotas',()=>expect(splitInstallments(100,3)).toEqual([33.33,33.33,33.34]))
 it('contabiliza solo la cuota del mes y no la compra completa',()=>{const data={transactions:[{id:'tx',amount:120,payment_method:'credit_card',installment_count:3,category_id:'food'}],installment_plans:[{id:'plan',transaction_id:'tx'}],installments:[{id:'q1',plan_id:'plan',amount:40,statement_period:'2026-08',status:'pending'}]};expect(expensesForPeriod(data,'2026-08')[0].amount).toBe(40)})
})
