
export default function PreviewTable({rows}){

return(

<table>

<tbody>

{rows.map((row,i)=>(

<tr key={i}>

{Object.values(row).map((v,j)=>(

<td key={j}>{v}</td>

))}

</tr>

))}

</tbody>

</table>

)

}
