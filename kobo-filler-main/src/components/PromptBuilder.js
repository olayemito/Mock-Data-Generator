
export default function PromptBuilder({setConfig}){

return(

<div>

<select onChange={e=>setConfig(c=>({...c,distribution:e.target.value}))}>

<option value="uniform">Uniform</option>
<option value="normal">Normal</option>
<option value="realistic">Realistic</option>

</select>

</div>

)

}
