import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Mail,
  Phone,
  Printer,
  MapPin,
  Calendar,
  Building,
  FileText,
  User,
  AlertCircle,
  Layers,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { getSingaporeEstimatedPriceInfo } from '@/utils/format';
import { GebizStructuredPayload, TenderDetailViewProps } from './types';

interface GebizDetailViewProps extends TenderDetailViewProps {
  payload?: GebizStructuredPayload | null;
}

export function GebizDetailView({
  payload,
}: GebizDetailViewProps) {
  const contact = payload?.contact ?? {};
  const briefing = payload?.site_briefing ?? {};
  const specs = payload?.specs ?? {};
  const lineItems = payload?.line_items ?? [];
  const deliveryInfo = payload?.delivery_info ?? [];

  const hasContact = Boolean(
    contact.name || contact.email || contact.phone || contact.address || contact.fax
  );
  const hasBriefing = Boolean(
    briefing.venue || briefing.briefing_date || briefing.attendance_compulsory || briefing.remarks
  );

  return (
    <div className="space-y-6">
      {/* KHỐI 1: THÔNG SỐ KỸ THUẬT & PHÁP LÝ (TENDER SPECIFICATIONS) */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Thông số kỹ thuật & Điều kiện pháp lý (Tender Specifications)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {specs.tender_no && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mã gói thầu (Tender No.)</dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">{specs.tender_no}</dd>
              </div>
            )}

            {specs.reference_no && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mã tham chiếu (Ref No.)</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.reference_no}</dd>
              </div>
            )}

            {specs.agency && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cơ quan mời thầu (Agency)</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.agency}</dd>
              </div>
            )}

            {specs.published && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ngày phát hành (Published)</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.published}</dd>
              </div>
            )}

            {specs.offer_validity && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Thời hạn hiệu lực hồ sơ</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.offer_validity}</dd>
              </div>
            )}

            {specs.procurement_type && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Loại hình mua sắm</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.procurement_type}</dd>
              </div>
            )}

            {specs.procurement_method && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phương thức lựa chọn</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.procurement_method}</dd>
              </div>
            )}

            {specs.tender_type && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Loại chi tiêu (Tender Type)</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.tender_type}</dd>
              </div>
            )}

            {specs.two_envelope_bidding && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Đấu thầu 2 túi hồ sơ</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.two_envelope_bidding}</dd>
              </div>
            )}

            {specs.wto_gpa && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Áp dụng WTO-GPA / FTA</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.wto_gpa}</dd>
              </div>
            )}

            {specs.procurement_nature && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tính chất hợp đồng</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.procurement_nature}</dd>
              </div>
            )}

            {specs.request_for_proposal && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cho phép đề xuất phương án (RFP)</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.request_for_proposal}</dd>
              </div>
            )}

            {specs.procurement_category && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Danh mục ngành nghề</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{specs.procurement_category}</dd>
              </div>
            )}

            {specs.gra_work_heads && (() => {
              const graInfo = getSingaporeEstimatedPriceInfo(null, 'SGD', specs.gra_work_heads);
              return (
                <div className="sm:col-span-2 lg:col-span-3 p-3.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Chứng chỉ & Hạn mức năng lực nhà thầu (GRA Tendering Capacity)
                  </dt>
                  <dd className="mt-1.5 text-sm font-bold text-foreground flex flex-wrap items-center gap-2">
                    <span>{specs.gra_work_heads}</span>
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      {graInfo ? `Khung quy mô: ${graInfo.displayRange}` : 'Hạn mức năng lực (Ước lượng)'}
                    </span>
                  </dd>
                  {graInfo && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      💡 Theo định mức GRA Singapore: Gói thầu này có quy mô tài chính ước tính trong khoảng <strong className="text-foreground font-semibold">{graInfo.displayRange}</strong> ({graInfo.ceilingText}).
                    </p>
                  )}
                </div>
              );
            })()}
          </dl>
        </CardContent>
      </Card>

      {/* KHỐI 2: ITEMS TO RESPOND (DANH MỤC HẠNG MỤC MỜI THẦU & GIAO HÀNG) */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground uppercase tracking-wide">
              <Layers className="h-4 w-4 text-primary" />
              Items to Respond (Danh mục hạng mục mời thầu)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            {lineItems.map((item, idx) => {
              const itemNum = idx + 1;
              const itemRecords =
                item.delivery_records && item.delivery_records.length > 0
                  ? item.delivery_records
                  : deliveryInfo.length > 0 && idx < deliveryInfo.length
                  ? [deliveryInfo[idx]]
                  : deliveryInfo;

              return (
                <div
                  key={idx}
                  className={`pt-5 first:pt-0 ${idx > 0 ? 'border-t border-border/70' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Dark Number Badge [ 1 ], [ 2 ] */}
                    <div className="w-9 h-9 bg-slate-800 dark:bg-slate-700 text-white font-bold text-sm flex items-center justify-center rounded shrink-0 shadow-sm mt-0.5">
                      {itemNum}
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* Subheader: Item No. & Mandatory to Bid */}
                      <div>
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {item.item_number || `Item No. ${itemNum}`}
                        </div>
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                          Mandatory to Bid: {item.mandatory_to_bid || 'Yes'}
                        </div>
                      </div>

                      {/* Main Item Description / Title */}
                      <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                        {item.title || item.description || `Item No. ${itemNum}`}
                      </h3>

                      {/* Item Specifications (UOM, Quantity, Remarks) */}
                      <div className="space-y-1.5 text-sm pt-1">
                        <div className="flex items-baseline gap-4">
                          <span className="w-36 text-xs uppercase font-medium tracking-wider text-muted-foreground shrink-0">
                            Unit of Measurement
                          </span>
                          <span className="font-semibold text-foreground">
                            {item.uom || 'LOT'}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-4">
                          <span className="w-36 text-xs uppercase font-medium tracking-wider text-muted-foreground shrink-0">
                            Required Quantity
                          </span>
                          <span className="font-semibold text-foreground">
                            {item.quantity || '1.0000'}
                          </span>
                        </div>

                        {item.remarks && (
                          <div className="flex items-baseline gap-4 pt-0.5">
                            <span className="w-36 text-xs uppercase font-medium tracking-wider text-muted-foreground shrink-0">
                              Remarks
                            </span>
                            <span className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                              {item.remarks}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Embedded DELIVERY INFORMATION Table for this specific item */}
                      {itemRecords && itemRecords.length > 0 && (
                        <div className="mt-3 rounded-md overflow-hidden border border-border">
                          <div className="bg-muted/80 px-3 py-1.5 border-b border-border text-xs font-bold uppercase tracking-wider text-foreground">
                            DELIVERY INFORMATION
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm">
                              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                                <tr>
                                  <th className="py-2 px-3 w-12 text-center">S/N</th>
                                  <th className="py-2 px-3">Location</th>
                                  <th className="py-2 px-3 w-32">Delivery Date</th>
                                  <th className="py-2 px-3 w-24 text-right">Quantity</th>
                                  <th className="py-2 px-3 w-32">Delivery Terms</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {itemRecords.map((rec, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                                    <td className="py-2 px-3 text-center text-muted-foreground font-medium">{rec.sn || rIdx + 1}</td>
                                    <td className="py-2 px-3 font-medium text-foreground">{rec.location || '-'}</td>
                                    <td className="py-2 px-3 whitespace-nowrap text-foreground font-semibold">{rec.delivery_date || '-'}</td>
                                    <td className="py-2 px-3 text-right font-medium text-foreground whitespace-nowrap">{rec.quantity || '-'}</td>
                                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{rec.delivery_terms || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* KHỐI 3: LAYOUT CHIA ĐÔI 2 CỘT (LIÊN HỆ & SITE BRIEFING) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CỘT TRÁI: THÔNG TIN LIÊN LẠC */}
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <User className="h-4 w-4 text-primary" />
              Thông tin liên hệ (Contact Information)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            {hasContact ? (
              <div className="space-y-3 text-sm">
                {contact.name && (
                  <div className="flex items-start gap-2.5">
                    <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Người liên hệ</p>
                      <p className="font-semibold text-foreground text-sm">{contact.name}</p>
                    </div>
                  </div>
                )}

                {contact.email && (
                  <div className="flex items-start gap-2.5">
                    <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</p>
                      <a
                        href={`mailto:${contact.email}`}
                        className="font-medium text-primary hover:underline underline-offset-2 break-all"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-start gap-2.5">
                    <Phone className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Điện thoại</p>
                      <a
                        href={`tel:${contact.phone}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}

                {contact.fax && (
                  <div className="flex items-start gap-2.5">
                    <Printer className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Số Fax</p>
                      <p className="font-medium text-foreground">{contact.fax}</p>
                    </div>
                  </div>
                )}

                {contact.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Địa chỉ cơ quan</p>
                      <p className="text-muted-foreground leading-relaxed">{contact.address}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Xem thông tin liên hệ trong hồ sơ mời thầu.</p>
            )}
          </CardContent>
        </Card>

        {/* CỘT PHẢI: KHẢO SÁT HIỆN TRƯỜNG & GIỚI THIỆU (SITE BRIEFING) */}
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Building className="h-4 w-4 text-primary" />
              Khảo sát hiện trường & Họp mở thầu (Site Briefing)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            {hasBriefing ? (
              <div className="space-y-3 text-sm">
                {briefing.attendance_compulsory && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Yêu cầu tham dự</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        briefing.attendance_compulsory.toLowerCase().includes('yes')
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {briefing.attendance_compulsory.toLowerCase().includes('yes') ? (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Bắt buộc tham dự (Compulsory)
                        </>
                      ) : (
                        'Không bắt buộc'
                      )}
                    </span>
                  </div>
                )}

                {(briefing.briefing_date || briefing.briefing_time) && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Thời gian họp</p>
                      <p className="font-semibold text-foreground">
                        {[briefing.briefing_date, briefing.briefing_time].filter(Boolean).join(' - ')}
                      </p>
                    </div>
                  </div>
                )}

                {briefing.venue && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Địa điểm tổ chức</p>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{briefing.venue}</p>
                    </div>
                  </div>
                )}

                {briefing.remarks && (
                  <div className="flex items-start gap-2.5 pt-1">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ghi chú & Hướng dẫn đăng ký</p>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{briefing.remarks}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">Không yêu cầu khảo sát hiện trường</p>
                <p className="text-xs text-muted-foreground mt-0.5">Gói thầu không có lịch Site Briefing bắt buộc.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
